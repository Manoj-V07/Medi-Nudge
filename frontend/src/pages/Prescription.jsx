import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Sidebar from "../components/Sidebar";

const STANDARD_LABELS = ["Morning", "Afternoon", "Evening", "Night"];

const TEN_MINUTES = 10 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

const todayString = () => new Date().toISOString().slice(0, 10);

const toMinutes = (hhmm) => {
  const [hour, minute] = String(hhmm || "00:00").split(":").map(Number);
  return hour * 60 + minute;
};

const playReminderSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.25);
  } catch (error) {
    // Keep silent fallback if browser blocks audio context.
  }
};

const timingSummary = (timing) => {
  if (!timing) {
    return "Not available";
  }

  if (timing.mode === "standard") {
    const selected = (timing.standardPattern || [])
      .map((value, index) => (value === 1 ? STANDARD_LABELS[index] : null))
      .filter(Boolean);

    return selected.length > 0 ? selected.join(", ") : "None selected";
  }

  if (timing.mode === "frequency") {
    return `${timing.frequencyPerDay} time(s) per day`;
  }

  return `Every ${timing.intervalHours} hour(s)`;
};

function Prescription() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [serverError, setServerError] = useState("");
  const [prescriptions, setPrescriptions] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [reminderStates, setReminderStates] = useState({});
  const [caregiverMessages, setCaregiverMessages] = useState([]);
  const [form, setForm] = useState({
    medicineName: "",
    dosageMg: "",
    durationDays: "",
    notes: "",
  });
  const [timingMode, setTimingMode] = useState("standard");
  const [standardPattern, setStandardPattern] = useState([1, 0, 0, 0]);
  const [frequencyPerDay, setFrequencyPerDay] = useState(2);
  const [intervalHours, setIntervalHours] = useState(6);

  const token = localStorage.getItem("token");

  const authConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const reminderStatesRef = useRef({});

  const loadData = async () => {
    try {
      setServerError("");
      const [prescriptionResponse, reminderResponse] = await Promise.all([
        api.get("/api/prescription", authConfig),
        api.get("/api/reminders", authConfig),
      ]);
      setPrescriptions(prescriptionResponse.data || []);
      const normalizedReminders = (reminderResponse.data || []).map((reminder, index) => ({
        ...reminder,
        localKey: `${reminder.medicineName}-${reminder.dosage}-${reminder.time}-${reminder.scheduledDate}-${index}`,
      }));
      setReminders(normalizedReminders);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }

      setServerError(error.response?.data?.message || "Failed to load medication data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    loadData();

    const intervalId = setInterval(() => {
      loadData();
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [token]);

  useEffect(() => {
    reminderStatesRef.current = reminderStates;
  }, [reminderStates]);

  useEffect(() => {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Ensure every reminder has a local tracking state for escalation checks.
    setReminderStates((prev) => {
      const next = {};

      reminders.forEach((reminder) => {
        const key = reminder.localKey;
        next[key] = prev[key] || {
          status: "pending",
          firstAlertAt: null,
          alertedAfter10Min: false,
          caregiverNotified: false,
        };
      });

      return next;
    });
  }, [reminders]);

  useEffect(() => {
    const triggerAlert = (title, body) => {
      playReminderSound();
      alert(`${title}\n${body}`);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    };

    const timerId = setInterval(() => {
      const now = new Date();
      const nowDate = now.toISOString().slice(0, 10);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const nextStates = { ...reminderStatesRef.current };
      let changed = false;

      reminders.forEach((reminder) => {
        if (reminder.scheduledDate !== nowDate) {
          return;
        }

        const key = reminder.localKey;
        const state = nextStates[key] || {
          status: "pending",
          firstAlertAt: null,
          alertedAfter10Min: false,
          caregiverNotified: false,
        };

        if (state.status !== "pending") {
          return;
        }

        const reminderMinutes = toMinutes(reminder.time);
        if (nowMinutes < reminderMinutes) {
          return;
        }

        if (!state.firstAlertAt) {
          triggerAlert("Medicine Reminder", `${reminder.medicineName} (${reminder.dosage} mg) at ${reminder.time}`);
          nextStates[key] = {
            ...state,
            firstAlertAt: now.toISOString(),
          };
          changed = true;
          return;
        }

        const elapsed = now.getTime() - new Date(state.firstAlertAt).getTime();

        if (elapsed >= TEN_MINUTES && !state.alertedAfter10Min) {
          triggerAlert(
            "Reminder Again",
            `${reminder.medicineName} has not been acknowledged after 10 minutes.`
          );
          nextStates[key] = {
            ...state,
            alertedAfter10Min: true,
          };
          changed = true;
        }

        if (elapsed >= THIRTY_MINUTES && !state.caregiverNotified) {
          nextStates[key] = {
            ...nextStates[key],
            status: "missed",
            caregiverNotified: true,
          };
          setCaregiverMessages((prev) => [
            ...prev,
            `${reminder.medicineName} at ${reminder.time}: Caregiver notified`,
          ]);
          triggerAlert("Escalation", "Caregiver notified");
          changed = true;
        }
      });

      if (changed) {
        reminderStatesRef.current = nextStates;
        setReminderStates(nextStates);
      }
    }, 30 * 1000);

    return () => clearInterval(timerId);
  }, [reminders]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const resetForm = () => {
    setForm({ medicineName: "", dosageMg: "", durationDays: "", notes: "" });
    setTimingMode("standard");
    setStandardPattern([1, 0, 0, 0]);
    setFrequencyPerDay(2);
    setIntervalHours(6);
  };

  const getTimingPayload = () => {
    if (timingMode === "standard") {
      return { mode: "standard", standardPattern };
    }

    if (timingMode === "frequency") {
      return { mode: "frequency", frequencyPerDay: Number(frequencyPerDay) };
    }

    return { mode: "interval", intervalHours: Number(intervalHours) };
  };

  const onInputChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const toggleStandardSlot = (slotIndex) => {
    setStandardPattern((prev) => {
      const next = [...prev];
      next[slotIndex] = next[slotIndex] === 1 ? 0 : 1;

      if (next.every((value) => value === 0)) {
        next[slotIndex] = 1;
      }

      return next;
    });
  };

  const addPrescription = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.medicineName || !form.dosageMg || !form.durationDays) {
      setFormError("Medicine name, dosage, and duration are required.");
      return;
    }

    if (Number(form.dosageMg) <= 0 || Number(form.durationDays) <= 0) {
      setFormError("Dosage and duration must be positive numbers.");
      return;
    }

    if (timingMode === "interval" && Number(intervalHours) < 1) {
      setFormError("Interval should be at least 1 hour.");
      return;
    }

    try {
      setSubmitting(true);
      await api.post(
        "/api/prescription",
        {
          medicineName: form.medicineName,
          dosageMg: Number(form.dosageMg),
          durationDays: Number(form.durationDays),
          notes: form.notes,
          timing: getTimingPayload(),
        },
        authConfig
      );
      await loadData();
      resetForm();
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }

      setFormError(error.response?.data?.message || "Failed to save prescription.");
    } finally {
      setSubmitting(false);
    }
  };

  const deletePrescription = async (id) => {
    try {
      await api.delete(`/api/prescription/${id}`, authConfig);
      await loadData();
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }

      setServerError(error.response?.data?.message || "Failed to delete prescription.");
    }
  };

  const acknowledgeReminder = (key) => {
    setReminderStates((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        status: "taken",
      },
    }));
  };

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <Sidebar logout={logout} />

      <section className="flex-1 overflow-auto">
        <div className="min-h-screen px-3 py-5 sm:px-6 sm:py-8">
          <div className="mx-auto grid w-full max-w-6xl gap-6">
            {serverError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{serverError}</p>
            )}

            <div className="space-y-6">
              <div>
                <h2 className="title-font text-2xl font-bold text-slate-800">Prescription Module</h2>
                <p className="mt-1 text-sm text-slate-600">Add medicines with structured timing.</p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <article className="glass-card rounded-3xl p-5 sm:p-6">
                  <h3 className="title-font text-lg font-bold text-slate-800">Add Prescription</h3>

                  <form onSubmit={addPrescription} className="mt-4 space-y-4">
                    <input
                      name="medicineName"
                      value={form.medicineName}
                      onChange={onInputChange}
                      placeholder="Medicine name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400"
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        name="dosageMg"
                        type="number"
                        min="1"
                        value={form.dosageMg}
                        onChange={onInputChange}
                        placeholder="Dosage (mg)"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400"
                      />
                      <input
                        name="durationDays"
                        type="number"
                        min="1"
                        value={form.durationDays}
                        onChange={onInputChange}
                        placeholder="Duration (days)"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400"
                      />
                    </div>

                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={onInputChange}
                      placeholder="Notes (optional)"
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400"
                    />

                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-700">Timing Type</p>
                      <div className="flex flex-wrap gap-2">
                        {["standard", "frequency", "interval"].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setTimingMode(mode)}
                            className={`rounded-xl px-3 py-2 text-sm font-semibold capitalize transition ${
                              timingMode === mode
                                ? "bg-teal-700 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {timingMode === "standard" && (
                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-700">Standard Slots</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {STANDARD_LABELS.map((label, index) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => toggleStandardSlot(index)}
                              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                standardPattern[index] === 1
                                  ? "bg-orange-500 text-white"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {timingMode === "frequency" && (
                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-700">Times per Day</p>
                        <select
                          value={frequencyPerDay}
                          onChange={(event) => setFrequencyPerDay(Number(event.target.value))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400"
                        >
                          {[1, 2, 3, 4].map((count) => (
                            <option key={count} value={count}>
                              {count} time(s) per day
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {timingMode === "interval" && (
                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-700">Interval in Hours</p>
                        <input
                          type="number"
                          min="1"
                          max="24"
                          value={intervalHours}
                          onChange={(event) => setIntervalHours(Number(event.target.value))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400"
                        />
                      </div>
                    )}

                    {formError && (
                      <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-70"
                    >
                      {submitting ? "Saving..." : "Add Prescription"}
                    </button>
                  </form>
                </article>

                <article className="glass-card rounded-3xl p-5 sm:p-6">
                  <h3 className="title-font text-lg font-bold text-slate-800">Your Prescriptions</h3>

                  <div className="mt-4 space-y-3">
                    {loading ? (
                      <p className="text-sm text-slate-600">Loading prescriptions...</p>
                    ) : prescriptions.length === 0 ? (
                      <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                        No prescriptions yet.
                      </p>
                    ) : (
                      prescriptions.map((item) => (
                        <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-800">{item.medicineName}</p>
                              <p className="text-sm text-slate-600">
                                {item.dosageMg} mg • {item.durationDays} day(s)
                              </p>
                              <p className="mt-1 text-xs text-slate-500">Timing: {timingSummary(item.timing)}</p>
                              {item.notes && <p className="mt-1 text-xs text-slate-500">Notes: {item.notes}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => deletePrescription(item._id)}
                              className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </div>

              <article className="glass-card rounded-3xl p-5 sm:p-6">
                <h3 className="title-font text-lg font-bold text-slate-800">Medication Reminders (Today)</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Alerts trigger at scheduled time, repeat in 10 minutes, and escalate after 30 minutes.
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {loading ? (
                    <p className="text-sm text-slate-600">Loading reminders...</p>
                  ) : reminders.length === 0 ? (
                    <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                      No reminders scheduled for today.
                    </p>
                  ) : (
                    reminders.map((reminder) => {
                      const key = reminder.localKey;
                      const localState = reminderStates[key] || {};
                      const status = localState.status || reminder.status || "pending";

                      return (
                        <article key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="font-semibold text-slate-800">{reminder.medicineName}</p>
                          <p className="text-sm text-slate-600">{reminder.dosage} mg</p>
                          <p className="mt-1 text-sm text-slate-600">Time: {reminder.time}</p>
                          <p className="mt-1 text-sm text-slate-600">Date: {reminder.scheduledDate}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status: {status}
                          </p>
                          {localState.caregiverNotified && (
                            <p className="mt-1 text-xs font-semibold text-rose-600">Caregiver notified</p>
                          )}

                          <div className="mt-3">
                            <button
                              type="button"
                              disabled={status !== "pending"}
                              onClick={() => acknowledgeReminder(key)}
                              className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50"
                            >
                              Mark Taken
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                {caregiverMessages.length > 0 && (
                  <div className="mt-5 rounded-xl bg-rose-50 p-4">
                    <p className="text-sm font-semibold text-rose-700">Escalation Log</p>
                    <ul className="mt-2 space-y-1 text-sm text-rose-700">
                      {caregiverMessages.map((message, index) => (
                        <li key={`${message}-${index}`}>{message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Prescription;

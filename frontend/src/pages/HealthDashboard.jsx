import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Sidebar from "../components/Sidebar";

const formatDateInput = (date) => new Date(date).toISOString().slice(0, 10);

const formatReadableDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const groupNotesByDate = (notes) => {
  const grouped = {};

  notes.forEach((item) => {
    const key = formatDateInput(item.entryDate);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  });

  return Object.entries(grouped).sort(([a], [b]) => (a < b ? 1 : -1));
};

const getIntervalFromType = (frequencyType, customDays) => {
  if (frequencyType === "weekly") return 7;
  if (frequencyType === "15days") return 15;
  if (frequencyType === "monthly") return 30;
  return Math.max(1, Number(customDays || 7));
};

function HealthDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [noteDate, setNoteDate] = useState(formatDateInput(new Date()));
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState([]);

  const [frequencyType, setFrequencyType] = useState("weekly");
  const [customDays, setCustomDays] = useState(7);
  const [summary, setSummary] = useState(null);

  const token = localStorage.getItem("token");

  const authConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const groupedNotes = useMemo(() => groupNotesByDate(notes), [notes]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const loadNotesAndSummary = async () => {
    const [notesResponse, summaryResponse] = await Promise.all([
      api.get("/api/health", authConfig),
      api.get("/api/summary", authConfig),
    ]);

    setNotes(notesResponse.data || []);

    const latestSummary = summaryResponse.data;
    if (latestSummary) {
      setSummary(latestSummary);
      setFrequencyType(latestSummary.frequencyType || "weekly");
      setCustomDays(latestSummary.intervalDays || 7);
    }

    return latestSummary;
  };

  const generateSummaryIfNeeded = async (nextType, nextCustomDays, force = false) => {
    const response = await api.post(
      "/api/summary/generate",
      {
        frequencyType: nextType,
        intervalDays: getIntervalFromType(nextType, nextCustomDays),
        customDays: nextType === "custom" ? Number(nextCustomDays) : undefined,
        force,
      },
      authConfig
    );

    if (response.data?.summary) {
      setSummary(response.data.summary);
    }

    if (response.data?.generated) {
      setSuccess("Summary sent to caregiver");
    } else {
      setSuccess(response.data?.message || "Latest summary is already up to date");
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const init = async () => {
      try {
        setError("");
        const latestSummary = await loadNotesAndSummary();
        const typeToUse = latestSummary?.frequencyType || "weekly";
        const customToUse = latestSummary?.intervalDays || 7;

        await generateSummaryIfNeeded(typeToUse, customToUse);
      } catch (apiError) {
        if (apiError.response?.status === 401) {
          logout();
          return;
        }
        setError(apiError.response?.data?.message || "Failed to load health dashboard");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token]);

  const handleAddNote = async (event) => {
    event.preventDefault();

    if (!noteText.trim()) {
      setError("Please write a health note before saving");
      return;
    }

    try {
      setSavingNote(true);
      setError("");
      setSuccess("");

      await api.post(
        "/api/health",
        {
          date: noteDate,
          notes: noteText.trim(),
        },
        authConfig
      );

      setNoteText("");
      await loadNotesAndSummary();
      setSuccess("Health note added");
    } catch (apiError) {
      if (apiError.response?.status === 401) {
        logout();
        return;
      }
      setError(apiError.response?.data?.message || "Failed to add health note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      setError("");
      await api.delete(`/api/health/${id}`, authConfig);
      await loadNotesAndSummary();
      setSuccess("Health note deleted");
    } catch (apiError) {
      if (apiError.response?.status === 401) {
        logout();
        return;
      }
      setError(apiError.response?.data?.message || "Failed to delete health note");
    }
  };

  const handleGenerateSummary = async () => {
    try {
      setGeneratingSummary(true);
      setError("");
      setSuccess("");
      await generateSummaryIfNeeded(frequencyType, customDays, true);
    } catch (apiError) {
      if (apiError.response?.status === 401) {
        logout();
        return;
      }
      setError(apiError.response?.data?.message || "Failed to generate summary");
    } finally {
      setGeneratingSummary(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-100 md:flex-row">
      <Sidebar logout={logout} />

      <section className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-6 rounded-3xl bg-white/80 p-6 shadow-xl backdrop-blur">
            <h1 className="title-font text-3xl font-bold text-slate-900">Health Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">
              Track daily notes and generate caregiver-friendly summaries using Groq.
            </p>
          </div>

          {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {success && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}

          <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
            <div className="space-y-6">
              <article className="rounded-3xl bg-white p-6 shadow-lg">
                <h2 className="text-xl font-bold text-slate-900">Add Daily Health Note</h2>
                <form onSubmit={handleAddNote} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                    <input
                      type="date"
                      value={noteDate}
                      onChange={(event) => setNoteDate(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                    <textarea
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Write how you felt today, symptoms, energy, sleep, or routines..."
                      rows={5}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingNote}
                    className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-70"
                  >
                    {savingNote ? "Saving..." : "Save Note"}
                  </button>
                </form>
              </article>

              <article className="rounded-3xl bg-white p-6 shadow-lg">
                <h2 className="text-xl font-bold text-slate-900">Health Notes</h2>
                {loading ? (
                  <p className="mt-4 text-sm text-slate-600">Loading notes...</p>
                ) : groupedNotes.length === 0 ? (
                  <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    No notes yet. Add your first health note.
                  </p>
                ) : (
                  <div className="mt-4 space-y-5">
                    {groupedNotes.map(([date, dateNotes]) => (
                      <div key={date}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {formatReadableDate(date)}
                        </p>
                        <div className="space-y-3">
                          {dateNotes.map((item) => (
                            <div key={item._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-sm leading-6 text-slate-700">{item.notes}</p>
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs text-slate-500">
                                  Added: {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNote(item._id)}
                                  className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </div>

            <div className="space-y-6">
              <article className="rounded-3xl bg-white p-6 shadow-lg">
                <h2 className="text-xl font-bold text-slate-900">Summary Settings</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Summary runs only when you open this dashboard or press generate.
                </p>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Frequency</label>
                    <select
                      value={frequencyType}
                      onChange={(event) => setFrequencyType(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400"
                    >
                      <option value="weekly">Weekly (7 days)</option>
                      <option value="15days">15 days</option>
                      <option value="monthly">Monthly (30 days)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  {frequencyType === "custom" && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Custom Days</label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={customDays}
                        onChange={(event) => setCustomDays(Number(event.target.value))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary}
                    className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-70"
                  >
                    {generatingSummary ? "Generating..." : "Generate / Check Summary"}
                  </button>
                </div>
              </article>

              <article className="rounded-3xl bg-white p-6 shadow-lg">
                <h2 className="text-xl font-bold text-slate-900">Latest Summary</h2>

                {!summary ? (
                  <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    No summary generated yet.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{summary.summaryText}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">General Insights</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{summary.insightsText}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                        <p className="text-xs text-slate-500">Frequency</p>
                        <p className="mt-1 font-semibold">{summary.frequencyType}</p>
                      </div>
                      <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                        <p className="text-xs text-slate-500">Interval Days</p>
                        <p className="mt-1 font-semibold">{summary.intervalDays}</p>
                      </div>
                      <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                        <p className="text-xs text-slate-500">Last Summary Date</p>
                        <p className="mt-1 font-semibold">
                          {summary.lastSummaryDate ? formatReadableDate(summary.lastSummaryDate) : "N/A"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                        <p className="text-xs text-slate-500">Notes Included</p>
                        <p className="mt-1 font-semibold">{summary.noteCount || 0}</p>
                      </div>
                    </div>
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

export default HealthDashboard;

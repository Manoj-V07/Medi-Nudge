import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Sidebar from "../components/Sidebar";

const FILTER_OPTIONS = [
  { value: "general", label: "General hospital" },
  { value: "cardiology", label: "Cardiology" },
  { value: "neurology", label: "Neurology" },
  { value: "multi-speciality", label: "Multi-speciality" },
];

const isPrescriptionActive = (item) => {
  const startDate = new Date(item.startDate || item.createdAt);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Number(item.durationDays || 0) - 1);
  endDate.setHours(23, 59, 59, 999);
  return new Date() <= endDate;
};

function HospitalSOS() {
  const navigate = useNavigate();
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [location, setLocation] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [filterType, setFilterType] = useState("general");

  const [sosTriggered, setSosTriggered] = useState(false);
  const [sosDetails, setSosDetails] = useState(null);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const authConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  const getCurrentLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported in this browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => reject(new Error("Location permission denied or unavailable")),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  const loadHospitals = async (nextFilter = filterType, forcedLocation = null) => {
    try {
      setLoadingHospitals(true);
      setError("");
      setSuccess("");

      const current = forcedLocation || location || (await getCurrentLocation());
      setLocation(current);

      const response = await api.get("/api/hospitals", {
        ...authConfig,
        params: {
          lat: current.lat,
          lng: current.lng,
          filter: nextFilter,
        },
      });

      setHospitals(response.data || []);

      if ((response.data || []).length === 0) {
        setSuccess("No nearby hospitals found for this category.");
      }
    } catch (apiError) {
      if (apiError.response?.status === 401) {
        logout();
        return;
      }
      setError(apiError.response?.data?.message || apiError.message || "Failed to fetch hospitals");
    } finally {
      setLoadingHospitals(false);
    }
  };

  const handleFindHospitals = async () => {
    await loadHospitals(filterType);
  };

  const handleFilterChange = async (event) => {
    const nextFilter = event.target.value;
    setFilterType(nextFilter);

    if (location) {
      await loadHospitals(nextFilter, location);
    }
  };

  const handleTriggerSos = async () => {
    const confirmed = window.confirm("Are you sure?");
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);

      const response = await api.get("/api/prescription", authConfig);
      const activePrescriptions = (response.data || []).filter(isPrescriptionActive);

      const alertPayload = {
        location: currentLocation,
        patientName: user?.name || "Unknown",
        caregiverPhone: user?.caregiverPhone || "Not available",
        conditions: "Not available",
        currentMedicines: activePrescriptions.map((item) => ({
          name: item.medicineName,
          dosageMg: item.dosageMg,
        })),
        triggeredAt: new Date().toISOString(),
      };

      console.log("[SOS SIMULATION] Alert sent to caregiver", {
        caregiverPhone: alertPayload.caregiverPhone,
        patientName: alertPayload.patientName,
        location: alertPayload.location,
      });

      setSosDetails(alertPayload);
      setSosTriggered(true);
      setSuccess("Emergency Alert Triggered. Alert sent to caregiver");
    } catch (apiError) {
      if (apiError.response?.status === 401) {
        logout();
        return;
      }
      setError(apiError.response?.data?.message || apiError.message || "Failed to trigger SOS");
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-rose-50 via-white to-sky-50 md:flex-row">
      <Sidebar logout={logout} />

      <section className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-6 rounded-3xl bg-white p-6 shadow-lg">
            <h1 className="title-font text-3xl font-bold text-slate-900">Hospital Locator + Emergency SOS</h1>
            <p className="mt-2 text-sm text-slate-600">
              Find nearby hospitals and quickly trigger emergency alerts for your caregiver.
            </p>
          </div>

          {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {success && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}

          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <article className="rounded-3xl bg-white p-6 shadow-lg">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-slate-900">Nearby Hospitals</h2>
                  <p className="mt-1 text-sm text-slate-600">Uses your location and OpenStreetMap data.</p>
                </div>

                <div className="w-full sm:w-56">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Filter</label>
                  <select
                    value={filterType}
                    onChange={handleFilterChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400"
                  >
                    {FILTER_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleFindHospitals}
                  disabled={loadingHospitals}
                  className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-70"
                >
                  {loadingHospitals ? "Searching..." : "Find Nearby Hospitals"}
                </button>
              </div>

              {location && (
                <p className="mt-3 text-xs font-medium text-slate-500">
                  Current Location: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </p>
              )}

              <div className="mt-5 space-y-3">
                {!loadingHospitals && hospitals.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Find hospitals to view nearby results.
                  </p>
                ) : (
                  hospitals.map((hospital, index) => (
                    <div key={`${hospital.name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{hospital.name}</p>
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                          {hospital.distanceKm !== null ? `${hospital.distanceKm} km` : "Distance N/A"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{hospital.address}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Rating: {hospital.rating !== null ? hospital.rating : "Not available"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-bold text-slate-900">Emergency SOS</h2>
              <p className="mt-1 text-sm text-slate-600">One-click emergency alert simulation for caregiver.</p>

              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm text-rose-800">
                  Press SOS only for urgent situations. You will be asked for confirmation.
                </p>
              </div>

              {sosTriggered && sosDetails && (
                <div className="mt-4 space-y-3 rounded-2xl border border-rose-200 bg-white p-4">
                  <p className="font-semibold text-rose-700">Emergency Alert Triggered</p>
                  <p className="text-sm text-slate-700">
                    Location: {sosDetails.location.lat.toFixed(5)}, {sosDetails.location.lng.toFixed(5)}
                  </p>
                  <p className="text-sm text-slate-700">Patient: {sosDetails.patientName}</p>
                  <p className="text-sm text-slate-700">Conditions: {sosDetails.conditions}</p>
                  <p className="text-sm text-slate-700">Caregiver: {sosDetails.caregiverPhone}</p>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Medicines</p>
                    {sosDetails.currentMedicines.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-600">No active prescriptions</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-sm text-slate-700">
                        {sosDetails.currentMedicines.map((item, idx) => (
                          <li key={`${item.name}-${idx}`}>{item.name} ({item.dosageMg} mg)</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-emerald-700">Alert sent to caregiver</p>
                </div>
              )}
            </article>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={handleTriggerSos}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-red-600 px-5 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-2xl transition hover:bg-red-700 sm:bottom-6 sm:right-6 sm:px-6"
      >
        SOS
      </button>
    </main>
  );
}

export default HospitalSOS;

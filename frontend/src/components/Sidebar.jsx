// Sidebar component with module navigation
import { useNavigate, useLocation } from "react-router-dom";

function Sidebar({ logout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside className="w-full bg-gradient-to-b from-slate-700 to-slate-600 p-4 shadow-2xl md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:p-6">
      <div className="flex h-full flex-col gap-6">
        {/* Header */}
        <div className="border-b border-slate-500 pb-6">
          <p className="title-font text-xl font-bold text-white">Dashboard</p>
          <p className="mt-2 text-sm text-slate-200">Healthcare Modules</p>
        </div>

        {/* Navigation */}
        <nav className="grid grid-cols-2 gap-3 md:mt-8 md:grid-cols-1">
          <button
            type="button"
            onClick={() => navigate("/emergency")}
            className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
              currentPath === "/emergency"
                ? "bg-white text-slate-800 shadow-lg"
                : "bg-slate-500 text-slate-100 hover:bg-slate-300 hover:text-slate-900"
            }`}
          >
            Hospital + SOS
          </button>

          <button
            type="button"
            onClick={() => navigate("/health")}
            className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
              currentPath === "/health"
                ? "bg-white text-slate-800 shadow-lg"
                : "bg-slate-500 text-slate-100 hover:bg-slate-300 hover:text-slate-900"
            }`}
          >
            Health Dashboard
          </button>

          <button
            type="button"
            onClick={() => navigate("/prescription")}
            className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
              currentPath === "/prescription"
                ? "bg-white text-slate-800 shadow-lg"
                : "bg-slate-500 text-slate-100 hover:bg-slate-300 hover:text-slate-900"
            }`}
          >
            Prescription
          </button>

          <button
            type="button"
            onClick={() => navigate("/chat")}
            className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
              currentPath === "/chat"
                ? "bg-white text-slate-800 shadow-lg"
                : "bg-slate-500 text-slate-100 hover:bg-slate-300 hover:text-slate-900"
            }`}
          >
            Chat
          </button>
        </nav>

        {/* Logout - pushed to bottom */}
        <div className="mt-auto border-t border-slate-500 pt-6">
          <button
            onClick={logout}
            className="w-full rounded-lg bg-rose-500 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    caregiverPhone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.name || !form.email || !form.password || !form.caregiverPhone) {
      setError("All fields are required.");
      return;
    }

    if (!/^\+?[0-9]{10,15}$/.test(form.caregiverPhone)) {
      setError("Caregiver phone must be 10 to 15 digits (optional + prefix).");
      return;
    }

    try {
      setLoading(true);
      await api.post("/api/auth/register", form);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-2">
        <section className="rounded-3xl p-8 text-slate-800 glass-card">
          <p className="mb-3 inline-flex rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
            Disease Awareness Platform
          </p>
          <h1 className="title-font text-4xl font-bold leading-tight sm:text-5xl">
            Create your account
          </h1>
          <p className="mt-4 text-slate-600">
            Track prescriptions and reminders with caregiver escalation support.
          </p>
        </section>

        <section className="glass-card rounded-3xl p-6 sm:p-8">
          <h2 className="title-font text-2xl font-bold text-slate-800">Register</h2>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-orange-400"
              type="text"
              name="name"
              placeholder="Full name"
              value={form.name}
              onChange={onChange}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-orange-400"
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={onChange}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-orange-400"
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={onChange}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-orange-400"
              type="text"
              name="caregiverPhone"
              placeholder="Caregiver phone (+919999999999)"
              value={form.caregiverPhone}
              onChange={onChange}
            />

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
            >
              {loading ? "Creating account..." : "Register"}
            </button>
          </form>

          <p className="mt-5 text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-800">
              Login
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export default Register;

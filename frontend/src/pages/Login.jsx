import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("Email and password are required.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/api/auth/login", form);
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-2">
        <section className="rounded-3xl p-8 text-slate-800 glass-card">
          <p className="mb-3 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            Secure Sign In
          </p>
          <h1 className="title-font text-4xl font-bold leading-tight sm:text-5xl">
            Welcome back
          </h1>
          <p className="mt-4 text-slate-600">
            Continue your disease-awareness conversations with a safe AI assistant.
          </p>
        </section>

        <section className="glass-card rounded-3xl p-6 sm:p-8">
          <h2 className="title-font text-2xl font-bold text-slate-800">Login</h2>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400"
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={onChange}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400"
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={onChange}
            />

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-70"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="mt-5 text-sm text-slate-600">
            New user?{" "}
            <Link to="/register" className="font-semibold text-orange-700 hover:text-orange-800">
              Register
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export default Login;

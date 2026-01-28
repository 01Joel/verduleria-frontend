import { useState } from "react";
import { motion } from "framer-motion";
import api from "../../api/api";
import { useAppStore } from "../../store/useAppStore";
import GlowBackground from "../../components/GlowBackground";

export default function Login() {
  const { setAuth } = useAppStore();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", form);

      // data: { ok, token, user }
      if (!data?.ok || !data?.token || !data?.user) {
        throw new Error("Respuesta inválida del servidor.");
      }

      setAuth({ token: data.token, user: data.user });
      window.location.href = "/dashboard";
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "No se pudo iniciar sesión.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlowBackground>
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-[0_0_70px_rgba(255,255,255,0.08)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Panel de Control
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Ingreso ADMIN / VENDEDOR
              </p>
            </div>
            <div className="text-xs text-zinc-400 border border-white/10 bg-white/5 rounded-xl px-3 py-1">
              v0.1
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs text-zinc-300">Usuario</label>
              <input
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20 transition"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Ej: admin"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300">Contraseña</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20 transition"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full rounded-xl bg-white text-zinc-950 font-medium py-2 hover:bg-zinc-100 transition disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </motion.div>
      </div>
    </GlowBackground>
  );
}

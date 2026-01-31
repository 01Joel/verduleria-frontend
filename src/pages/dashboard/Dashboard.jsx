import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";
import { useAppStore } from "../../store/useAppStore";

function pickTodaySession(sessions = []) {
  // Preferimos ABIERTA; si no, PLANIFICACION; si no, la más reciente (incluye CERRADA)
  const open = sessions
    .filter((s) => s.status === "ABIERTA")
    .sort((a, b) => new Date(b.dateTarget || b.createdAt) - new Date(a.dateTarget || a.createdAt))[0];
  if (open) return open;

  const plan = sessions
    .filter((s) => s.status === "PLANIFICACION")
    .sort((a, b) => new Date(b.dateTarget || b.createdAt) - new Date(a.dateTarget || a.createdAt))[0];
  if (plan) return plan;

  return (
    sessions
      .slice()
      .sort((a, b) => new Date(b.dateTarget || b.createdAt) - new Date(a.dateTarget || a.createdAt))[0] || null
  );
}

function badgeByStatus(status) {
  if (status === "ABIERTA")
    return "bg-green-500/10 text-green-300 border-green-500/20 shadow-[0_0_18px_rgba(16,185,129,0.55)] animate-pulse";
  if (status === "PLANIFICACION")
    return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20 shadow-[0_0_18px_rgba(255,217,102,0.55)] animate-pulse";
  if (status === "CERRADA")
    return "bg-zinc-500/10 text-zinc-300 border-white/10 shadow-[0_0_18px_rgba(91,91,91,0.55)] animate-pulse";
  return "bg-white/5 text-zinc-300 border-white/10";
}

export default function Dashboard() {
  // ✅ IMPORTANTE: si tu store tiene isAdmin como función, acá debe ser:
  // const { user, isAdmin } = useAppStore();
  // y luego usar: const isAdminRole = typeof isAdmin === "function" ? isAdmin() : !!isAdmin;
  const { user, isAdmin } = useAppStore();
  const isAdminRole = typeof isAdmin === "function" ? isAdmin() : !!isAdmin;

  const [sessions, setSessions] = useState([]);
  const [loadingSession, setLoadingSession] = useState(true);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");

  const todaySession = useMemo(() => pickTodaySession(sessions), [sessions]);
  const sessionStatus = todaySession?.status || null;

  const canCreateSession = !todaySession || sessionStatus === "CERRADA";
  const canGoToSession = sessionStatus === "ABIERTA";
  const canPlanSession = sessionStatus === "PLANIFICACION";
  const canCloseSession = sessionStatus === "ABIERTA";

  const refreshSessions = async () => {
    try {
      setLoadingSession(true);
      const { data } = await api.get("/purchase-sessions/");
      setSessions(data?.ok ? data.sessions || [] : []);
    } catch (e) {
      setSessions([]);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateSession = async () => {
    if (!isAdminRole) return;

    try {
      setCreateError("");
      setCreating(true);

      const { data } = await api.post("/purchase-sessions/");
      if (data?.ok) {
        await refreshSessions();
        return;
      }
      setCreateError(data?.message || "No se pudo crear la sesión.");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Error de red al crear la sesión.";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleCloseSession = async () => {
    if (!isAdminRole || !todaySession?._id) return;

    // Confirmación simple (sin modal extra)
    const ok = window.confirm(
      `¿Cerrar sesión ${todaySession.dateKey}?\n\nEsto recalcula precios, cierra la operativa y ya no se podrán confirmar compras.`
    );
    if (!ok) return;

    try {
      setCloseError("");
      setClosing(true);

      const { data } = await api.post(`/purchase-sessions/${todaySession._id}/close`);
      if (!data?.ok) {
        setCloseError(data?.message || "No se pudo cerrar la sesión.");
        return;
      }

      await refreshSessions();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Error de red al cerrar la sesión.";
      setCloseError(msg);
    } finally {
      setClosing(false);
    }
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">PANEL DE CONTROL</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Bienvenido, <span className="text-zinc-200">{user?.username}</span>
            </p>
          </div>

          <div className="text-xs text-zinc-400 border border-white/10 bg-white/5 rounded-xl px-3 py-1">
            local
          </div>
        </div>

        {/* Sesión del día */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-zinc-400">Sesión del día</p>

              {loadingSession ? (
                <p className="mt-1 text-sm text-zinc-300">Cargando sesión…</p>
              ) : todaySession ? (
                <p className="mt-1 text-sm">
                  Fecha: <span className="text-zinc-200">{todaySession.dateKey}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-zinc-300">No hay sesiones creadas todavía.</p>
              )}
            </div>

            <span className={`text-[11px] rounded-lg border px-2 py-1 ${badgeByStatus(todaySession?.status)}`}>
              {todaySession?.status || "—"}
            </span>
          </div>

          {/* =========================
              VENDEDOR: solo precios
              ========================= */}
          {!isAdminRole && (
            <div className="mt-4">
              <Link
                to="/precios"
                className="block rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium text-center hover:bg-zinc-100 transition"
              >
                Ver Precios del día
              </Link>
              <p className="text-xs text-zinc-500 mt-2">
                Vista rápida para venta. (Promos vendrán aquí)
              </p>
            </div>
          )}

          {/* =========================
              ADMIN: acciones y menú
              ========================= */}
          {isAdminRole && (
            <>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* CERRADA o sin sesión -> Crear sesión */}
                {canCreateSession && (
                  <button
                    onClick={handleCreateSession}
                    disabled={creating}
                    className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${
                      creating ? "bg-white/60 text-zinc-950 cursor-not-allowed" : "bg-white text-zinc-950 hover:bg-zinc-100"
                    }`}
                  >
                    {creating ? "Creando sesión…" : "Crear nueva sesión"}
                  </button>
                )}

                {/* PLANIFICACION -> ir a planificación */}
                {canPlanSession && (
                  <Link
                    to="/session/planificacion"
                    className="rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium text-center hover:bg-zinc-100 transition"
                  >
                    Ir a planificación
                  </Link>
                )}

                {/* ABIERTA -> ir a sesión */}
                {canGoToSession && (
                  <Link
                    to="/session"
                    className="rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium text-center hover:bg-zinc-100 transition"
                  >
                    Ir a Sesión de compra
                  </Link>
                )}

                {/* Precios del día (admin) */}
                {(sessionStatus === "ABIERTA" || sessionStatus === "CERRADA") && (
                  <Link
                    to="/precios"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-center hover:bg-white/10 transition"
                  >
                    Ver Precios del día
                  </Link>
                )}

                {/* ✅ Cerrar sesión (solo si está ABIERTA) */}
                {canCloseSession && (
                  <button
                    onClick={handleCloseSession}
                    disabled={closing}
                    className={`rounded-xl px-4 py-3 text-sm font-medium text-center border transition ${
                      closing
                        ? "border-red-500/20 bg-red-500/10 text-red-200 opacity-70 cursor-not-allowed"
                        : "border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                    }`}
                  >
                    {closing ? "Cerrando sesión…" : "Cerrar sesión"}
                  </button>
                )}
              </div>

              {/* errores */}
              {createError && (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                  <p className="text-xs text-red-200">{createError}</p>
                </div>
              )}
              {closeError && (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                  <p className="text-xs text-red-200">{closeError}</p>
                </div>
              )}

              {/* menú admin */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Link
                  to="/precios"
                  className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-center hover:bg-white/10 transition"
                >
                  Ajustar margen global
                </Link>
                <Link
                  to="/admin/promociones"
                  className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-center hover:bg-white/10 transition"
                >
                  Promociones
                </Link>
              </div>

              <div className="mt-2 grid grid-cols-1 md:grid-cols-4 sm:gap-4 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
                  <Link
                    to="/admin/proveedores"
                    className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-center hover:bg-white/10 transition"
                  >
                    Proveedores-registro
                  </Link>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
                  <Link
                    to="/admin/vendedores"
                    className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-center hover:bg-white/10 transition"
                  >
                    Vendedores-registro
                  </Link>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
                  <Link
                    to="/admin/productos"
                    className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-center hover:bg-white/10 transition"
                  >
                    Productos-registro
                  </Link>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
                  <Link
                    to="/admin/variantes"
                    className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-center hover:bg-white/10 transition"
                  >
                    Variantes-registro
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AppLayout>
  );
}

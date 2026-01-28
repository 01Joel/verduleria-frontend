import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import api from "../../api/api";
import AppLayout from "../../components/AppLayout";
import SessionHeader from "./components/SessionHeader";
import ItemsTabs from "./components/ItemsTabs";
import socket from "../../socket";

function pickDefaultSession(sessions = []) {
  // Priorizamos ABIERTA. Si no hay, devolvemos PLANIFICACION más reciente (solo para mostrar mensaje).
  const open = sessions.filter((s) => s.status === "ABIERTA");
  if (open.length) {
    return open.sort((a, b) => {
      const da = new Date(a.dateTarget || a.createdAt).getTime();
      const db = new Date(b.dateTarget || b.createdAt).getTime();
      return db - da;
    })[0];
  }

  const plan = sessions.filter((s) => s.status === "PLANIFICACION");
  if (plan.length) {
    return plan.sort((a, b) => {
      const da = new Date(a.dateTarget || a.createdAt).getTime();
      const db = new Date(b.dateTarget || b.createdAt).getTime();
      return db - da;
    })[0];
  }

  return null;
}

export default function SessionCompra() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [items, setItems] = useState([]);

  const selectedSession = useMemo(() => pickDefaultSession(sessions), [sessions]);
  const sessionId = selectedSession?._id || null;

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setItems([]);
      return;
    }
    loadItems(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    socket.emit("session:join", { sessionId });
    return () => socket.emit("session:leave", { sessionId });
  }, [sessionId]);

  const init = async () => {
    try {
      setLoading(true);
      await loadSessions();
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const { data } = await api.get("/purchase-sessions/");
      const list = data?.ok ? data.sessions || [] : [];
      setSessions(list);
      return list;
    } catch (err) {
      console.error("Error cargando sesiones", err);
      setSessions([]);
      setItems([]);
      return [];
    }
  };

  const loadItems = async (sid) => {
    try {
      const { data } = await api.get(`/purchase-sessions/${sid}/items`);
      setItems(data?.items || []);
    } catch (err) {
      console.error("Error cargando items", err);
      setItems([]);
    }
  };

  const reload = async () => {
    const list = await loadSessions();
    const s = pickDefaultSession(list);
    if (s?._id) await loadItems(s._id);
  };

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-zinc-400">Cargando sesión…</p>
      </AppLayout>
    );
  }

  if (!selectedSession) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm">No hay sesión ABIERTA ni en PLANIFICACIÓN.</p>
          <p className="text-xs text-zinc-500 mt-2">
            Crea una sesión y vuelve a intentar.
          </p>
        </div>
      </AppLayout>
    );
  }

  const isOpenSession = selectedSession?.status === "ABIERTA";

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-4"
      >
        <SessionHeader session={selectedSession} />

        {!isOpenSession && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-zinc-200">
              La sesión no está ABIERTA.
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Abre la sesión desde Planificación para poder comprar/reservar.
            </p>
          </div>
        )}

        <ItemsTabs
          session={selectedSession}
          items={items}
          onReload={reload}
        />
      </motion.div>
    </AppLayout>
  );
}

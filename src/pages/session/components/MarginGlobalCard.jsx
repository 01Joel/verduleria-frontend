import { useEffect, useMemo, useState } from "react";
import { getMargin, setMargin } from "../api/config";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// UI trabaja en porcentaje 1–150 (backend acepta 0.35 o 35)
function pctToUi(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return 35;
  return Math.round(n * 100); // 0.35 -> 35
}

function uiToPct(ui) {
  const n = Number(ui);
  if (!Number.isFinite(n)) return 0.35;
  return n / 100; // 35 -> 0.35
}

export default function MarginGlobalCard({ sessionId, socket }) {
  const [loading, setLoading] = useState(true);
  const [uiPct, setUiPct] = useState(35); // 35%
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const pctDecimal = useMemo(() => uiToPct(uiPct), [uiPct]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getMargin();
        if (!mounted) return;
        if (data?.ok) setUiPct(pctToUi(data.marginPct));
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "No se pudo cargar el margen.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => (mounted = false);
  }, []);

  // Socket: cuando el backend cambia margen, reflejarlo sin recargar
  useEffect(() => {
    if (!socket) return;

    const onMarginUpdated = (payload) => {
      // Si vino sessionId, lo validamos para no pisar otras sesiones
      if (payload?.sessionId && sessionId && payload.sessionId !== String(sessionId)) return;

      const nextUi = pctToUi(payload?.marginPct);
      setUiPct(nextUi);
      setOkMsg(`Margen actualizado a ${nextUi}% (en vivo).`);
      setTimeout(() => setOkMsg(""), 1500);
    };

    socket.on("margin_updated", onMarginUpdated);
    return () => socket.off("margin_updated", onMarginUpdated);
  }, [socket, sessionId]);

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      setOkMsg("");

      // backend permite 35 o 0.35; enviamos 35 para claridad
      const data = await setMargin(uiPct);

      if (!data?.ok) throw new Error("No se pudo guardar el margen.");

      // Aunque socket lo actualizará, dejamos feedback inmediato
      const nextUi = pctToUi(data.marginPct);
      setUiPct(nextUi);
      setOkMsg(`Guardado: ${nextUi}%`);
      setTimeout(() => setOkMsg(""), 1500);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Error guardando margen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Margen global</p>
          <p className="text-xs text-zinc-500 mt-1">
            Aplica a los precios del día (sesión abierta o última).
          </p>
        </div>

        <span className="text-[11px] rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-zinc-300">
          ADMIN
        </span>
      </div>

      {error && (
        <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {okMsg && (
        <div className="mt-3 rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
          {okMsg}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3 items-end">
        <div>
          <label className="text-xs text-zinc-300">Margen (%)</label>

          <input
            type="range"
            min={5}
            max={150}
            value={uiPct}
            disabled={loading || saving}
            onChange={(e) => setUiPct(clamp(Number(e.target.value), 5, 150))}
            className="mt-2 w-full"
          />

          <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
            <span>5%</span>
            <span>150%</span>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            value={uiPct}
            disabled={loading || saving}
            onChange={(e) => {
              const n = clamp(Number(e.target.value || 0), 5, 150);
              setUiPct(n);
            }}
            className="w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
            inputMode="numeric"
            placeholder="35"
          />

          <button
            onClick={save}
            disabled={loading || saving}
            className="rounded-xl bg-white text-zinc-950 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-zinc-500">
        Margen actual: <span className="text-zinc-200">{uiPct}%</span> (decimal:{" "}
        <span className="text-zinc-300">{pctDecimal.toFixed(2)}</span>)
      </p>
    </div>
  );
}

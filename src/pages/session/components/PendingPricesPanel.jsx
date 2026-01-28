// src/pages/session/components/PendingPricesPanel.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../../api/api";

function formatARS(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function badgeByStatus(status) {
  if (status === "LISTO") return "bg-green-500/10 text-green-300 border-green-500/20";
  if (status === "PARCIAL") return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
  return "bg-zinc-500/10 text-zinc-300 border-white/10";
}

function pickImg(dp) {
  const variant = dp?.variantId;
  const product = variant?.productId;
  return variant?.imageUrl || product?.imageUrl || "";
}

function titleOf(dp) {
  const variant = dp?.variantId;
  const product = variant?.productId;
  return product?.name || "Producto";
}

function subtitleOf(dp) {
  const variant = dp?.variantId;
  return `${variant?.nameVariant || "—"} · ${variant?.unitSale || dp?.unitSale || "—"}`;
}

export default function PendingPricesPanel({ sessionId, onReload }) {
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState("");

  // inputs por dailyPriceId
  const [inputs, setInputs] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get("/daily-prices/pending", {
        params: { sessionId },
      });

      const list = data?.ok ? data.pending || [] : [];
      setPending(list);

      // Inicializar inputs con lastManualSalePrice (si existe) o salePrice (si existe) o vacío
      setInputs((prev) => {
        const next = { ...prev };
        for (const dp of list) {
          const id = dp?._id;
          if (!id) continue;

          // si el usuario ya escribió algo, no lo pisamos
          if (next[id] != null && String(next[id]).length > 0) continue;

          const suggested = dp?.lastManualSalePrice ?? dp?.salePrice ?? "";
          next[id] = suggested === null ? "" : String(suggested);
        }
        return next;
      });
    } catch (e) {
      setPending([]);
      setError(e?.response?.data?.message || "Error cargando precios pendientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ✅ Auto refresh cada 15s, pero se pausa si estás guardando (evita “rebotes”)
  useEffect(() => {
    if (!sessionId) return;
    if (savingId) return;
    const id = setInterval(() => load(), 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, savingId]);

  const count = pending?.length || 0;

  const grid = useMemo(() => {
    const arr = pending.slice();
    const rank = (s) => (s === "PARCIAL" ? 0 : 1);
    arr.sort((a, b) => rank(a?.status) - rank(b?.status));
    return arr;
  }, [pending]);

  const setValue = (id, value) => {
    setInputs((prev) => ({ ...prev, [id]: value }));
  };

  const save = async (dp) => {
    const id = dp?._id;
    if (!id) return;

    // ✅ normaliza coma argentina a punto
    const raw = String(inputs[id] ?? "").trim().replace(",", ".");
    const n = Number(raw);

    if (!Number.isFinite(n) || n <= 0) {
      setError("El precio debe ser un número mayor a 0");
      return;
    }

    try {
      setSavingId(id);
      setError("");

      await api.patch(`/daily-prices/${id}/manual`, {
        salePrice: n,
        note: "",
      });

      // UI: quitar de pendientes localmente
      setPending((prev) => prev.filter((x) => x._id !== id));

      onReload?.();
    } catch (e) {
      setError(e?.response?.data?.message || "Error guardando precio manual");
    } finally {
      setSavingId(null);
    }
  };

  if (count === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Precios pendientes</p>
            <p className="text-xs text-zinc-500">
              Aquí aparecen productos que no se pueden calcular automáticamente.
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        <p className="text-xs text-zinc-500 text-center py-3">
          No hay precios pendientes.
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Precios pendientes</p>
          <p className="text-xs text-zinc-500">
            Define precio manual para casos no calculables (ej: compra por UNIDAD y venta por KG).
          </p>
        </div>

        <button
          onClick={load}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
          {error}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
        {grid.map((dp) => {
          const img = pickImg(dp);
          const title = titleOf(dp);
          const subtitle = subtitleOf(dp);
          const status = dp?.status || "PENDIENTE";

          const last = dp?.lastManualSalePrice;
          const hint = last != null ? `Último: ${formatARS(last)}` : "Sin histórico";

          const id = dp?._id;
          const val = inputs[id] ?? "";
          const isSaving = savingId === id;

          return (
            <div key={id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start gap-2">
                <div className="h-10 w-10 rounded-xl bg-white/10 overflow-hidden flex-shrink-0 border border-white/10">
                  {img ? (
                    <img
                      src={img}
                      alt={title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{title}</p>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {subtitle}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] rounded-lg border px-2 py-0.5 ${badgeByStatus(status)}`}
                    >
                      {status}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-500 mt-1">{hint}</p>
                </div>
              </div>

              <div className="mt-2">
                <p className="text-[11px] text-zinc-500">Precio manual (ARS)</p>
                <input
                  inputMode="decimal"
                  value={val}
                  onChange={(e) => setValue(id, e.target.value)}
                  placeholder={last != null ? String(last) : "Ej: 700"}
                  className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20 transition text-sm"
                />
              </div>

              <button
                onClick={() => save(dp)}
                disabled={isSaving}
                className="mt-2 w-full rounded-xl bg-white text-zinc-950 px-3 py-2 text-sm font-medium disabled:opacity-60"
              >
                {isSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

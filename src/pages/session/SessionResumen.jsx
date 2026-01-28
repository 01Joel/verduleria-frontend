// src/pages/session/SessionResumen.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";

/* ------------------ helpers ------------------ */

function pickDefaultSession(sessions = []) {
  const open = sessions.filter((s) => s.status === "ABIERTA");
  if (open.length) return open.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  const closed = sessions.filter((s) => s.status === "CERRADA");
  if (closed.length) return closed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  return null;
}

function formatARS(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function meRole() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return u?.role || null;
  } catch {
    return null;
  }
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
}

/** E icon (trend) */
function trendIcon(d, f) {
  const D = toNum(d);
  const F = toNum(f);
  if (F > D) return "↑";
  if (F < D) return "↓";
  return "=";
}

/** E style: ↑ rojo fosforescente / ↓ verde fosforescente / = blanco fosforescente */
function trendPillClass(icon) {
  if (icon === "↑") {
    return "bg-red-500/15 text-red-200 border-red-400/40 shadow-[0_0_18px_rgba(239,68,68,0.55)]";
  }
  if (icon === "↓") {
    return "bg-emerald-500/15 text-emerald-200 border-emerald-400/40 shadow-[0_0_18px_rgba(16,185,129,0.55)]";
  }
  return "bg-white/10 text-zinc-100 border-white/25 shadow-[0_0_16px_rgba(255,255,255,0.35)]";
}

function labelPago(v) {
  const x = String(v || "");
  if (!x) return "SIN_DEFINIR";
  return x;
}

function labelPagoUi(key) {
  const map = {
    EFECTIVO: "Efectivo",
    MERCADO_PAGO: "Mercado Pago",
    NX: "NX",
    OTRO: "Otro",
    SIN_DEFINIR: "Sin definir",
  };
  return map[key] || key;
}


/** Totals card color by payment method */
function paymentCardClass(method) {
  // Fondo claro diferenciado
  if (method === "MERCADO_PAGO") return "bg-sky-400/15 border-sky-300/30 shadow-[0_0_18px_rgba(41,134,204,0.55)]";
  if (method === "EFECTIVO") return "bg-emerald-400/15 border-emerald-300/30 shadow-[0_0_18px_rgba(16,185,129,0.55)]";
  if (method === "NX") return "bg-[#CE7E00]/20 border-[#FFD966] shadow-[0_0_18px_rgba(206,126,0,0.55)]";
  return "bg-white/10 border-white/10";
}

/** Debounce por key */
function useDebounceMap() {
  const timers = useRef(new Map());

  const debounce = (key, fn, ms = 600) => {
    const k = String(key);
    const prev = timers.current.get(k);
    if (prev) clearTimeout(prev);

    const t = setTimeout(() => {
      timers.current.delete(k);
      fn();
    }, ms);

    timers.current.set(k, t);
  };

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  return debounce;
}

/* ------------------ component ------------------ */

export default function SessionResumen() {
  const debounce = useDebounceMap();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);

  const [lots, setLots] = useState([]);
  const [items, setItems] = useState([]);

  const [savingKey, setSavingKey] = useState(null);

  const isAdmin = useMemo(() => meRole() === "ADMIN", []);
  const selectedSession = useMemo(() => pickDefaultSession(sessions), [sessions]);
  const sessionId = selectedSession?._id || null;

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setLots([]);
      setItems([]);
      return;
    }
    loadAll(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const init = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/purchase-sessions/");
      setSessions(data?.ok ? data.sessions || [] : []);
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async (sid) => {
    const [lotsRes, itemsRes] = await Promise.allSettled([
      api.get(`/purchase-lots?sessionId=${sid}`),
      api.get(`/purchase-sessions/${sid}/items`),
    ]);

    setLots(lotsRes.status === "fulfilled" ? lotsRes.value?.data?.lots || [] : []);
    setItems(itemsRes.status === "fulfilled" ? itemsRes.value?.data?.items || [] : []);
  };

  // ✅ Presupuestos desde la sesión
  const plannedBudgetReal = useMemo(() => {
    const n = Number(selectedSession?.plannedBudgetReal);
    return Number.isFinite(n) ? n : null;
  }, [selectedSession?.plannedBudgetReal]);

  const plannedBudgetRef = useMemo(() => {
    const n = Number(selectedSession?.plannedBudgetRef);
    return Number.isFinite(n) ? n : null;
  }, [selectedSession?.plannedBudgetRef]);

  // variantId -> fila D (refPrice)
  const dByVariantId = useMemo(() => {
    const map = new Map();
    for (const it of items || []) {
      const v = it?.variantId && typeof it.variantId === "object" ? it.variantId : null;
      const vid = v?._id || it?.variantId;
      if (!vid) continue;
      const d = Number(it?.refPrice);
      map.set(String(vid), Number.isFinite(d) ? d : 0);
    }
    return map;
  }, [items]);

  // Agrupar LOTS por (productId, variantId) -> filas planilla
  const rows = useMemo(() => {
    const map = new Map(); // key: productId:variantId -> group

    for (const lot of lots || []) {
      const v = lot?.variantId || null;
      const p = v?.productId || null;

      const productId = p?._id ? String(p._id) : "no-product";
      const productName = p?.name || "Producto";

      const variantId = v?._id ? String(v._id) : "no-variant";
      const variantName = v?.nameVariant || "—";

      const buyUnit = lot?.buyUnit || v?.unitBuy || "—";
      const key = `${productId}:${variantId}`;

      if (!map.has(key)) {
        map.set(key, {
          groupId: key,
          productId,
          productName,
          variantId,
          variantName,
          buyUnit,
          qtyTotal: 0,
          fTotal: 0,
          lots: [],
        });
      }

      const g = map.get(key);
      const qty = toNum(lot?.qty);
      const unitCost = toNum(lot?.unitCost);
      g.qtyTotal += qty;
      g.fTotal += qty * unitCost;
      g.lots.push(lot);
    }

    const arr = Array.from(map.values()).map((g) => {
      const d = toNum(dByVariantId.get(g.variantId));

      const methods = new Set(g.lots.map((x) => x?.paymentMethod || "").filter(Boolean));
      const notes = new Set(g.lots.map((x) => x?.paymentNote || "").filter(Boolean));

      const icon = trendIcon(d, g.fTotal);

      return {
        ...g,
        d,
        trend: icon, // E solo icono
        paymentMethod: methods.size === 1 ? Array.from(methods)[0] : "",
        paymentNote: notes.size === 1 ? Array.from(notes)[0] : "",
        hasMixedPayment: methods.size > 1 || notes.size > 1,
      };
    });

    arr.sort((a, b) => {
      const c = a.productName.localeCompare(b.productName, "es");
      if (c !== 0) return c;
      return a.variantName.localeCompare(b.variantName, "es");
    });

    return arr;
  }, [lots, dByVariantId]);

  const idxByGroupId = useMemo(() => {
    const map = new Map();
    let i = 1;
    for (const r of rows) {
      map.set(r.groupId, i);
      i += 1;
    }
    return map;
  }, [rows]);

  const totals = useMemo(() => {
    let sumD = 0;
    let sumF = 0;
    for (const r of rows) {
      sumD += toNum(r.d);
      sumF += toNum(r.fTotal);
    }
    return { sumD, sumF };
  }, [rows]);

  const totalsByPayment = useMemo(() => {
    const acc = new Map(); // method -> sumF
    for (const r of rows) {
      const key = labelPago(r.paymentMethod);
      acc.set(key, (acc.get(key) || 0) + toNum(r.fTotal));
    }
    return Array.from(acc.entries())
      .map(([method, sumF]) => ({ method, sumF }))
      .sort((a, b) => b.sumF - a.sumF);
  }, [rows]);

  // ✅ Diferencia presupuesto vs gastado
  const budgetDelta = useMemo(() => {
    if (plannedBudgetReal == null) return null;
    const delta = plannedBudgetReal - totals.sumF;
    return Number.isFinite(delta) ? delta : null;
  }, [plannedBudgetReal, totals.sumF]);

  // PATCH masivo: aplicar pago/nota a TODOS los lots del grupo
  const patchGroupPayment = async (row, patch) => {
    if (!row?.lots?.length) return;

    try {
      setSavingKey(row.groupId);
      await Promise.all(row.lots.map((lot) => api.patch(`/purchase-lots/${lot._id}/payment`, patch)));
      await loadAll(sessionId);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-zinc-400">Cargando resumen…</p>
      </AppLayout>
    );
  }

  if (!selectedSession) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm">No hay sesión para mostrar.</p>
          <Link
            to="/session"
            className="inline-block mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
          >
            Volver
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-4"
      >
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-200">Resumen de compras</p>
            <p className="text-xs text-zinc-500 mt-1">
              Sesión: <span className="text-zinc-200">{selectedSession?.dateKey || "—"}</span>
              {" · "}Estado: <span className="text-zinc-200">{selectedSession?.status || "—"}</span>
              {" · "}Filas: <span className="text-zinc-200">{rows.length}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/session"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
            >
              Volver a compras
            </Link>
          </div>
        </div>

        {/* TABLA COMPACTA (desktop) */}
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-zinc-200">Aún no hay compras registradas.</p>
          </div>
        ) : (
          <div className="hidden md:block rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Fondo más claro + encabezado único */}
            <div className="grid grid-cols-16 gap-2 px-4 py-2.5 border-b border-white/10 text-[11px] text-zinc-200 bg-black/30">
              <div className="col-span-1">#</div>
              <div className="col-span-3">PRODUCTO</div>
              <div className="col-span-3">VARIANTE</div>
              <div className="col-span-1">CANT</div>
              <div className="col-span-1">UNID</div>
              <div className="col-span-1">TOT SUG</div>
              <div className="col-span-1">COMP</div>
              <div className="col-span-1">COST REAL</div>
              <div className="col-span-2"> TIPO DE PAGO</div>
              <div className="col-span-2">NOTA</div>
            </div>

            <div className="divide-y divide-white/10 bg-white/5">
              {rows.map((r) => {
                const n = idxByGroupId.get(r.groupId);
                const isSaving = savingKey === r.groupId;

                return (
                  <div key={r.groupId} className={`px-4 py-2 ${isSaving ? "opacity-80" : ""}`}>
                    <div className="grid grid-cols-16 gap-2 items-center">
                      <div className="col-span-1 text-[12px] text-zinc-200">{n}</div>

                      <div className="col-span-3 min-w-0">
                        <p className="text-[12px] text-zinc-200 truncate">{r.productName}</p>
                      </div>

                      <div className="col-span-3 min-w-0">
                        <p className="text-[12px] text-zinc-200 truncate">{r.variantName}</p>
                        {r.hasMixedPayment ? (
                          <p className="text-[10px] text-amber-300 truncate">Pago/nota mezclados</p>
                        ) : null}
                      </div>

                      <div className="col-span-1 text-[12px] text-zinc-200">{fmtQty(r.qtyTotal)}</div>
                      <div className="col-span-1 text-[12px] text-zinc-200">{r.buyUnit}</div>

                      <div className="col-span-1 text-[12px] text-zinc-200">{formatARS(r.d)}</div>

                      {/* ✅ Fila E con entorno fosforescente */}
                      <div className="col-span-1">
                        <span
                          className={`inline-flex items-center justify-center w-9 h-7 rounded-xl border text-[12px] font-semibold ${trendPillClass(
                            r.trend
                          )}`}
                          title="Comparación D vs F"
                        >
                          {r.trend}
                        </span>
                      </div>

                      <div className="col-span-1 text-[12px] font-semibold text-zinc-100">
                        {formatARS(r.fTotal)}
                      </div>

                      {/* PAGO alineado a lado de F */}
                      <div className="col-span-2">
                        <select
                          disabled={!isAdmin || isSaving}
                          value={r.paymentMethod || ""}
                          onChange={(ev) => patchGroupPayment(r, { paymentMethod: ev.target.value })}
                          className="w-full rounded-xl bg-white/10 border border-white/15 px-2 py-1.5 text-[12px] text-zinc-400 outline-none focus:border-white/25 transition disabled:opacity-10"
                          title="Tipo de pago (se aplica a todos los lotes de la variante)"
                        >
                          <option value="">Sin definir</option>
                          <option value="EFECTIVO">Efectivo</option>
                          <option value="MERCADO_PAGO">Mercado Pago</option>
                          <option value="NX">NX</option>
                          <option value="OTRO">Otro</option>
                        </select>
                      </div>

                      {/* NOTA alineada a lado de F */}
                      <div className="col-span-2">
                        <input
                          disabled={!isAdmin || isSaving}
                          defaultValue={r.paymentNote || ""}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            debounce(
                              `note:${r.groupId}`,
                              () => patchGroupPayment(r, { paymentNote: v }),
                              700
                            );
                          }}
                          className="w-full rounded-xl bg-white/10 border border-white/15 px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/25 transition disabled:opacity-60"
                          placeholder="Nota…"
                          title="Nota de pago (se aplica a todos los lotes de la variante)"
                        />
                      </div>
                    </div>

                    {isSaving ? <p className="mt-1 text-[11px] text-zinc-500">Guardando…</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MOBILE */}
        {rows.length > 0 && (
          <div className="md:hidden space-y-2">
            {rows.map((r) => {
              const n = idxByGroupId.get(r.groupId);
              const isSaving = savingKey === r.groupId;

              return (
                <div key={r.groupId} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] text-zinc-400">#{n}</p>
                      <p className="text-sm font-semibold text-zinc-200 truncate">{r.productName}</p>
                      <p className="text-[12px] text-zinc-300 truncate">{r.variantName}</p>
                      {r.hasMixedPayment ? (
                        <p className="text-[11px] text-amber-300 mt-1">Pago/nota mezclados</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-zinc-500">F</p>
                      <p className="text-sm font-semibold text-zinc-100">{formatARS(r.fTotal)}</p>
                      <div className="mt-1 flex items-center justify-end gap-2">
                        <span className="text-[11px] text-zinc-400">D: {formatARS(r.d)}</span>
                        <span
                          className={`inline-flex items-center justify-center w-9 h-7 rounded-xl border text-[12px] font-semibold ${trendPillClass(
                            r.trend
                          )}`}
                        >
                          {r.trend}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[12px] text-zinc-300">
                    <span>
                      {fmtQty(r.qtyTotal)} {r.buyUnit}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <select
                      disabled={!isAdmin || isSaving}
                      value={r.paymentMethod || ""}
                      onChange={(ev) => patchGroupPayment(r, { paymentMethod: ev.target.value })}
                      className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/25 transition disabled:opacity-60 text-zinc-100"
                    >
                      <option value="">Sin definir</option>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="MERCADO_PAGO">Mercado Pago</option>
                      <option value="NX">NX</option>
                      <option value="OTRO">Otro</option>
                    </select>

                    <input
                      disabled={!isAdmin || isSaving}
                      defaultValue={r.paymentNote || ""}
                      onChange={(ev) => {
                        const v = ev.target.value;
                        debounce(`note:${r.groupId}`, () => patchGroupPayment(r, { paymentNote: v }), 700);
                      }}
                      className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/25 transition disabled:opacity-60 text-zinc-100"
                      placeholder="Nota…"
                    />

                    {isSaving ? <p className="text-[11px] text-zinc-500">Guardando…</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TOTALES (después de la tabla) */}
        {rows.length > 0 && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-zinc-200">Totales</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                  <p className="text-xs text-zinc-100">Σ TOTAL SUGERIDO</p>
                  <p className="text-lg font-semibold text-zinc-100 mt-1">{formatARS(totals.sumD)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                  <p className="text-xs text-zinc-100">Σ COSTO REAL</p>
                  <p className="text-lg font-semibold text-zinc-100 mt-1">{formatARS(totals.sumF)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                  <p className="text-xs text-zinc-100">PRESUPUESTO REAL</p>
                  <p className="text-lg font-semibold text-zinc-100 mt-1">
                    {plannedBudgetReal == null ? "—" : formatARS(plannedBudgetReal)}
                  </p>
                  {budgetDelta != null ? (
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Saldo:{" "}
                      <span className={budgetDelta < 0 ? "text-red-200" : "text-emerald-200"}>
                        {formatARS(budgetDelta)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-zinc-500 mt-1">Define el presupuesto en Planificación.</p>
                  )}
                  {plannedBudgetRef != null ? (
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Ref (planif): <span className="text-zinc-200">{formatARS(plannedBudgetRef)}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              {/* ✅ encabezado con presupuesto al lado (como pediste) */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Totales por tipo de pago</p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Se calcula en base a Costo (real).
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[11px] text-zinc-600">Presupuesto real</p>
                  <p className="text-sm font-semibold text-zinc-90">
                    {plannedBudgetReal == null ? "—" : formatARS(plannedBudgetReal)}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {totalsByPayment.map((t) => (
                  <div
                    key={t.method}
                    className={`rounded-2xl border p-3 ${paymentCardClass(t.method)}`}
                  >
                    <p className="text-xs text-zinc-400">{labelPagoUi(t.method)}</p>
                    <p className="text-base font-semibold text-zinc-100 mt-1">{formatARS(t.sumF)}</p>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-500 mt-3">
                Nota: si una variante tiene pagos/notas mezclados, quedará como “Sin definir” hasta que lo unifiques.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
}

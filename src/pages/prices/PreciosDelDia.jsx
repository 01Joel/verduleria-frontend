// PreciosDelDia.jsx (CORREGIDO cuidadosamente para ADMIN + VENDEDOR con /board)
// ✅ Fix principal: eliminar referencias a p.variantId... cuando el vendedor usa rows planos
// ✅ Fix del crash: `v is not defined` (había `v?.unitSale` en vendorGrouped)
// ✅ Mantiene: Admin table intacta con listAdminPurchasedDailyPrices
// ✅ Vendedor: usa listDailyPriceBoard y opera con campos planos { category, productName, nameVariant, unitSale, salePrice, movement, delta, ... }

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";
import SessionModeChips from "../session/components/SessionModeChips";

import AdminPriceDetailModal from "./components/AdminPriceDetailModal";
import { listVendorPromotions } from "./api/promotions";
import { listDailyPriceBoard } from "./api/dailyPrices";

import {
  listAdminPurchasedDailyPrices,
  updateVariantConversionAndRecalc,
  getMargin,
  setMargin,
  recalcSessionDailyPrices,
} from "./api/dailyPrices";

import { useAppStore } from "../../store/useAppStore";

function promoImg(url, seed) {
  if (!url) return "";
  const v = seed ? new Date(seed).getTime() : Date.now();
  return url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`;
}

function pickDefaultMode(sessions = []) {
  const hasOpen = sessions.some((s) => s.status === "ABIERTA");
  if (hasOpen) return "ABIERTA";

  const hasPlan = sessions.some((s) => s.status === "PLANIFICACION");
  if (hasPlan) return "PLANIFICACION";

  const hasClosed = sessions.some((s) => s.status === "CERRADA");
  return hasClosed ? "CERRADA" : null;
}

function pickSessionByMode(sessions = [], mode) {
  const list = sessions.filter((s) => s.status === mode);
  if (list.length === 0) return null;

  return list.sort((a, b) => {
    const da = new Date(a.dateTarget || a.createdAt).getTime();
    const db = new Date(b.dateTarget || b.createdAt).getTime();
    return db - da;
  })[0];
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

function formatDeltaARS(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const txt = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(abs);
  return n > 0 ? `+${txt}` : n < 0 ? `-${txt}` : `${txt}`;
}

function movUi(mov) {
  if (mov === "UP") return { sym: "↑", cls: "text-green-300 bg-green-500/10 border-green-500/20" };
  if (mov === "DOWN") return { sym: "↓", cls: "text-red-300 bg-red-500/10 border-red-500/20" };
  if (mov === "SAME") return { sym: "=", cls: "text-zinc-300 bg-white/5 border-white/10" };
  return { sym: "•", cls: "text-zinc-400 bg-white/5 border-white/10" }; // NEW / sin dato
}

function normalizeCategory(raw) {
  const s = String(raw || "").trim();
  if (!s) return "OTROS";
  return s.toUpperCase();
}

function sortKey(str) {
  return String(str || "").trim().toLowerCase();
}

export default function PreciosDelDia() {
  const isAdmin = useAppStore((s) => s.isAdmin);

  const [loading, setLoading] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [sessionMode, setSessionMode] = useState(null);

  const selectedSession = useMemo(() => {
    if (!sessionMode) return null;
    return pickSessionByMode(sessions, sessionMode);
  }, [sessions, sessionMode]);

  const [prices, setPrices] = useState([]);
  const [q, setQ] = useState("");

  // ✅ margen global (solo admin lo ve)
  const [marginPct, setMarginPct] = useState(null);
  const [savingMargin, setSavingMargin] = useState(false);
  const marginDebounceRef = useRef(null);

  // admin modal detalle
  const [openAdminDetail, setOpenAdminDetail] = useState(false);
  const [activeAdminPrice, setActiveAdminPrice] = useState(null);

  // inline conversion (admin)
  const [editingConv, setEditingConv] = useState({});
  const [savingConv, setSavingConv] = useState({});

  // ✅ vendedor: filtro por categoría (para “memoria muscular”)
  const [catFilter, setCatFilter] = useState("TODOS");

  const [promoViews, setPromoViews] = useState([]);

  const loadMargin = async () => {
    if (!isAdmin) return;
    try {
      const data = await getMargin();
      if (data?.ok) setMarginPct(data.marginPct);
    } catch (e) {
      console.error("Error cargando margen", e);
      setMarginPct(null);
    }
  };

  const loadSessions = async ({ keepMode } = { keepMode: true }) => {
    const { data } = await api.get("/purchase-sessions/");
    const list = data?.ok ? data.sessions || [] : [];
    setSessions(list);

    setSessionMode((prev) => {
      if (keepMode && prev) return prev;
      return prev || pickDefaultMode(list);
    });

    return list;
  };

  const loadPrices = async (sessionId) => {
    if (isAdmin) {
      const data = await listAdminPurchasedDailyPrices(sessionId);
      setPrices(data?.prices || []);
    } else {
      const data = await listDailyPriceBoard(sessionId);
      setPrices(data?.rows || []); // ✅ vendedor: rows planos
    }
  };

  const loadPromos = async (sessionId) => {
    if (isAdmin) return; // solo vendedor
    const data = await listVendorPromotions(sessionId);
    setPromoViews(data?.views || []);
  };

  // ✅ admin: cambia margen con debounce y recalcula precios de la sesión actual
  const onChangeMarginSlider = (valueInt) => {
    const next = Number(valueInt) / 100;
    setMarginPct(next);

    if (marginDebounceRef.current) clearTimeout(marginDebounceRef.current);

    marginDebounceRef.current = setTimeout(async () => {
      if (!selectedSession?._id) return;

      try {
        setSavingMargin(true);

        const saved = await setMargin(next);
        if (!saved?.ok) return;

        await recalcSessionDailyPrices(selectedSession._id);
        await loadPrices(selectedSession._id);
      } catch (e) {
        console.error("Error guardando margen", e);
      } finally {
        setSavingMargin(false);
      }
    }, 450);
  };

  const init = async () => {
    try {
      setLoading(true);
      await loadMargin();

      const list = await loadSessions({ keepMode: false });
      const initialMode = pickDefaultMode(list);
      const initialSession = pickSessionByMode(list, initialMode);

      if (initialSession?._id) {
        await loadPrices(initialSession._id);
        await loadPromos(initialSession._id);
      } else {
        setPrices([]);
        setPromoViews([]);
      }
    } catch (e) {
      console.error("Error cargando precios", e);
      setSessions([]);
      setSessionMode(null);
      setPrices([]);
      setPromoViews([]);
      setMarginPct(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedSession?._id) {
      setPrices([]);
      setPromoViews([]);
      return;
    }
    loadPrices(selectedSession._id);
    loadPromos(selectedSession._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?._id]);

  const refresh = async () => {
    await loadMargin();
    await loadSessions({ keepMode: true });
    if (selectedSession?._id) {
      await loadPrices(selectedSession._id);
      await loadPromos(selectedSession._id);
    }
  };

  // ✅ filtro/búsqueda: cambia según rol (admin tiene populate; vendedor es plano)
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    const base = !term
      ? prices
      : prices.filter((p) => {
          if (isAdmin) {
            const prod = p?.variantId?.productId?.name?.toLowerCase() || "";
            const varName = p?.variantId?.nameVariant?.toLowerCase() || "";
            return prod.includes(term) || varName.includes(term);
          }
          // vendedor (board)
          const prod = String(p?.productName || "").toLowerCase();
          const varName = String(p?.nameVariant || "").toLowerCase();
          return prod.includes(term) || varName.includes(term);
        });

    if (isAdmin) return base;

    if (catFilter === "TODOS") return base;

    return base.filter((p) => normalizeCategory(p?.category) === catFilter);
  }, [prices, q, isAdmin, catFilter]);

  // ✅ chips categorías (solo vendedor) desde rows planos
  const vendorCategories = useMemo(() => {
    if (isAdmin) return [];
    const set = new Set();
    for (const p of prices) {
      set.add(normalizeCategory(p?.category));
    }
    const list = Array.from(set);

    const preferred = ["VERDURA", "FRUTA", "HORTALIZA", "OTROS"];
    list.sort((a, b) => {
      const ia = preferred.indexOf(a);
      const ib = preferred.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b);
    });

    return list;
  }, [prices, isAdmin]);

  // ✅ VENDEDOR: agrupar + orden estable (SIN v)
  const vendorGrouped = useMemo(() => {
    if (isAdmin) return [];

    const byCat = new Map();

    for (const p of filtered) {
      const cat = normalizeCategory(p?.category);
      const prodName = p?.productName || "Producto";
      const varName = p?.nameVariant || "—";

      const row = {
        key: String(p?.variantId || `${cat}-${prodName}-${varName}`),
        cat,
        prodName,
        varName,
        unitSale: p?.unitSale || "KG",
        salePrice: p?.salePrice ?? null,
        movement: p?.movement || "NEW",
        delta: p?.delta ?? null,
        isFromToday: Boolean(p?.isFromToday),
        lastDateKey: p?.lastDateKey || null,
      };

      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(row);
    }

    for (const [cat, rows] of byCat.entries()) {
      rows.sort((a, b) => {
        const pa = sortKey(a.prodName);
        const pb = sortKey(b.prodName);
        if (pa !== pb) return pa.localeCompare(pb);
        return sortKey(a.varName).localeCompare(sortKey(b.varName));
      });
      byCat.set(cat, rows);
    }

    const cats = Array.from(byCat.keys());
    const preferred = ["VERDURA", "FRUTA", "HORTALIZA", "OTROS"];
    cats.sort((a, b) => {
      const ia = preferred.indexOf(a);
      const ib = preferred.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b);
    });

    return cats.map((cat) => ({ cat, rows: byCat.get(cat) || [] }));
  }, [filtered, isAdmin]);

  const onSaveConversion = async (row) => {
    // Solo admin usa esto; row debe ser price con variantId populate
    const sessionId = selectedSession?._id;
    const variantId = row?.variantId?._id;
    if (!sessionId || !variantId) return;

    const raw = editingConv[variantId];
    const conversion = raw === "" ? null : raw;

    try {
      setSavingConv((s) => ({ ...s, [variantId]: true }));

      const data = await updateVariantConversionAndRecalc({
        sessionId,
        variantId,
        conversion,
      });

      if (!data?.ok) return;

      setPrices((prev) =>
        prev.map((x) => (String(x._id) === String(data.price._id) ? data.price : x))
      );
    } catch (e) {
      console.error("Error guardando conversión", e);
    } finally {
      setSavingConv((s) => ({ ...s, [variantId]: false }));
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-zinc-400">Cargando…</p>
      </AppLayout>
    );
  }

  if (!sessionMode || !selectedSession) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm">No hay sesiones disponibles.</p>
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
        {/* HEADER */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Precios del día</p>
              <p className="text-xs text-zinc-500 mt-1">
                Sesión: <span className="text-zinc-200">{selectedSession.dateKey}</span> · Modo:{" "}
                <span className="text-zinc-200">{sessionMode}</span>
                {isAdmin && marginPct != null && (
                  <>
                    {" "}
                    · Margen: <span className="text-zinc-200">{Math.round(marginPct * 100)}%</span>
                    {savingMargin && <span className="text-zinc-500"> · guardando…</span>}
                  </>
                )}
              </p>
            </div>

            <button
              onClick={refresh}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
            >
              Actualizar
            </button>
          </div>

          <div className="mt-3">
            <SessionModeChips mode={sessionMode} onChange={setSessionMode} showClosed={!isAdmin} />
          </div>

          {/* ✅ SLIDER margen global (solo admin) */}
          {isAdmin && marginPct != null && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Margen global</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{Math.round(marginPct * 100)}%</p>
                </div>
                <div className="text-xs text-zinc-400">Aplica a la sesión actual</div>
              </div>

              <div className="mt-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(marginPct * 100)}
                  onChange={(e) => onChangeMarginSlider(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* ✅ chips de categoría SOLO vendedor */}
          {!isAdmin && vendorCategories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setCatFilter("TODOS")}
                className={`rounded-xl px-3 py-2 text-xs border transition ${
                  catFilter === "TODOS" ? "bg-white text-zinc-950" : "bg-white/5 border-white/10 text-zinc-300"
                }`}
              >
                TODOS
              </button>

              {vendorCategories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className={`rounded-xl px-3 py-2 text-xs border transition ${
                    catFilter === c ? "bg-white text-zinc-950" : "bg-white/5 border-white/10 text-zinc-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
              placeholder="Buscar producto o variante..."
            />
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm">
              {isAdmin ? "No hay compras registradas en esta sesión." : "No hay precios para esta sesión."}
            </p>
          </div>
        )}

        {/* ---------------- ADMIN: TABLA ---------------- */}
        {isAdmin && filtered.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full text-sm">
                <thead className="bg-white/5 text-[11px] text-zinc-200">
                  <tr>
                    <th className="text-left px-4 py-3">Producto / Variante</th>
                    <th className="text-right px-3 py-3">Cant.</th>
                    <th className="text-left px-3 py-3">Unidad</th>
                    <th className="text-right px-3 py-3">Total</th>
                    <th className="text-right px-3 py-3">Costo de venta</th>
                    <th className="text-left px-3 py-3">Movimiento</th>
                    <th className="text-left px-3 py-3">Conversión</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((p) => {
                    const v = p?.variantId;
                    const prod = v?.productId?.name || "Producto";
                    const varName = v?.nameVariant || "—";

                    const unitBuy = v?.unitBuy || "—";
                    const unitSale = v?.unitSale || p?.unitSale || "KG";

                    const boughtQty = Number(p?.purchase?.boughtQty ?? 0);
                    const boughtTotal = Number(p?.purchase?.boughtTotal ?? 0);

                    const variantId = v?._id;
                    const currentConv = v?.conversion ?? "";

                    const localValue =
                      editingConv[variantId] !== undefined
                        ? editingConv[variantId]
                        : String(currentConv ?? "");

                    const isSaving = !!savingConv[variantId];

                    const mov = p?.movement || "NEW";
                    const { sym, cls } = movUi(mov);
                    const delta = p?.delta;

                    const prevLabel =
                      p?.prevSalePrice != null
                        ? `Ayer (${p?.prevDateKey || "sesión anterior"}): ${formatARS(p.prevSalePrice)}`
                        : "Sin precio previo";

                    return (
                      <tr key={p._id} className="border-t border-white/10">
                        <td className="px-4 py-3">
                          <p className="font-medium">{prod}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {varName} · vende {unitSale}
                          </p>
                        </td>

                        <td className="px-3 py-3 text-right tabular-nums font-medium">
                          {boughtQty > 0 ? boughtQty : "—"}
                        </td>

                        <td className="px-3 py-3 text-xs text-zinc-300">{unitBuy}</td>

                        <td className="px-3 py-3 text-right tabular-nums">
                          {boughtTotal > 0 ? formatARS(boughtTotal) : "—"}
                        </td>

                        <td className="px-3 py-3 text-right tabular-nums font-semibold">
                          {p?.salePrice != null ? formatARS(p.salePrice) : "—"}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              title={prevLabel}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border ${cls} font-semibold`}
                            >
                              {sym}
                            </span>

                            <span
                              title={prevLabel}
                              className={
                                mov === "UP"
                                  ? "text-xs text-green-300 tabular-nums"
                                  : mov === "DOWN"
                                  ? "text-xs text-red-300 tabular-nums"
                                  : "text-xs text-zinc-400 tabular-nums"
                              }
                            >
                              {delta == null ? "—" : formatDeltaARS(delta)}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center justify-start gap-2">
                            <input
                              value={localValue}
                              onChange={(e) => setEditingConv((s) => ({ ...s, [variantId]: e.target.value }))}
                              className="w-24 rounded-xl bg-zinc-950/40 border border-white/10 px-2 py-2 text-right tabular-nums outline-none focus:border-white/20 transition"
                              placeholder="—"
                            />
                            <button
                              onClick={() => onSaveConversion(p)}
                              disabled={isSaving}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition disabled:opacity-50"
                            >
                              {isSaving ? "Guardando…" : "Guardar"}
                            </button>

                            <button
                              onClick={() => {
                                setActiveAdminPrice(p);
                                setOpenAdminDetail(true);
                              }}
                              className="ml-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                            >
                              Detalle
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- VENDEDOR: LISTA FIJA (PIZARRA) ---------------- */}
        {!isAdmin && filtered.length > 0 && (
          <div className="space-y-3">
            {vendorGrouped.map((g) => (
              <div key={g.cat} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                {/* Header categoría */}
                <div className="px-4 py-3 bg-gradient-to-r from-white/10 to-white/0 border-b border-white/10">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{g.cat}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{g.rows.length} ítems</p>
                    </div>

                    <div className="hidden sm:block text-[11px] text-zinc-400">Mov · Nombre · Precio</div>
                  </div>
                </div>

                {/* Header “tabla” solo en desktop */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-[84px_1fr_190px] gap-2 px-4 py-2 text-[11px] text-zinc-400">
                    <div>Mov.</div>
                    <div>Producto / Variante</div>
                    <div className="text-right">Precio</div>
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-white/10">
                  {g.rows.map((r) => {
                    const { sym, cls } = movUi(r.movement);
                    const delta = r.delta;

                    const deltaCls =
                      r.movement === "UP" ? "text-green-300" : r.movement === "DOWN" ? "text-red-300" : "text-zinc-400";

                    return (
                      <div key={r.key} className="px-3 sm:px-4 py-3">
                        {/* MOBILE */}
                        <div className="sm:hidden">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3 min-w-0">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-2xl border ${cls} font-semibold`}>
                                  {sym}
                                </span>
                                <span className={`text-[11px] ${deltaCls} tabular-nums`}>
                                  {delta == null ? "—" : formatDeltaARS(delta)}
                                </span>
                              </div>

                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{r.prodName}</p>
                                <p className="text-sm text-zinc-400 truncate mt-0.5">
                                  {r.varName} · {r.unitSale}
                                </p>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className="text-2xl font-extrabold tabular-nums leading-none">
                                {r.salePrice != null ? formatARS(r.salePrice) : "—"}
                              </p>
                              <p className="text-[15px] text-zinc-500 mt-1">por {r.unitSale}</p>
                            </div>
                          </div>
                        </div>

                        {/* DESKTOP */}
                        <div className="hidden sm:grid grid-cols-[84px_1fr_190px] gap-2 items-center">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center justify-center w-10 h-10 rounded-2xl border ${cls} font-semibold`}>
                              {sym}
                            </span>
                            <span className={`text-[11px] ${deltaCls} tabular-nums`}>
                              {delta == null ? "—" : formatDeltaARS(delta)}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{r.prodName}</p>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">
                              {r.varName} · {r.unitSale}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-xl font-extrabold tabular-nums leading-tight">
                              {r.salePrice != null ? formatARS(r.salePrice) : "—"}
                            </p>
                            <p className="text-[11px] text-zinc-500 mt-1">por {r.unitSale}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* ---------------- PROMOCIONES (VENDEDOR) ---------------- */}
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-yellow-500/10 to-white/0 border-b border-white/10">
                <p className="text-sm font-semibold">Promociones</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {promoViews.length > 0 ? `${promoViews.length} activas` : "No hay promociones activas"}
                </p>
              </div>

              {promoViews.length === 0 ? (
                <div className="p-4">
                  <p className="text-sm text-zinc-300">—</p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {promoViews.map((pv) => {
                    const v = pv?.variantId;
                    const prod = v?.productId?.name || "Producto";
                    const varName = v?.nameVariant || "—";

                    const unitSale = pv?.pricing?.unitSale || v?.unitSale || "—";

                    const isPct = pv?.type === "PERCENT_OFF";
                    const isBogo = pv?.type === "BOGO";

                    const label = isPct ? `${pv?.percentOff}% OFF` : isBogo ? `${pv?.buyQty}x${pv?.payQty}` : "PROMO";

                    const promoPrice = isPct ? pv?.pricing?.promoPrice : null;
                    const comboPrice = isBogo ? pv?.pricing?.comboPrice : null;

                    return (
                      <div key={pv._id} className="px-3 sm:px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 bg-white/10 flex-shrink-0">
                            {pv?.imageUrl ? (
                              <img
                                src={promoImg(pv.imageUrl, pv.updatedAt || pv.endsAt)}
                                alt="promo"
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full bg-white/5" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] px-2 py-1 rounded-lg border border-yellow-500/20 bg-yellow-500/10 text-yellow-300 font-semibold animate-bounce">
                                {label}
                              </span>
                              <span className="text-[11px] text-zinc-500">{unitSale}</span>
                            </div>

                            <p className="text-sm font-semibold truncate mt-1">{prod}</p>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">{varName}</p>
                          </div>

                          <div className="text-right flex-shrink-0">
                            {isPct && (
                              <>
                                <p className="text-2xl font-extrabold tabular-nums leading-none text-yellow-200">
                                  {promoPrice != null ? formatARS(promoPrice) : "—"}
                                </p>
                                <p className="text-[11px] text-zinc-500 mt-1">precio promo</p>
                              </>
                            )}

                            {isBogo && (
                              <>
                                <p className="text-2xl font-extrabold tabular-nums leading-none text-yellow-200">
                                  {comboPrice != null ? formatARS(comboPrice) : "—"}
                                </p>
                                <p className="text-[11px] text-zinc-500 mt-1">paga {pv?.payQty}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* admin modal */}
        <AdminPriceDetailModal
          open={openAdminDetail}
          onClose={() => setOpenAdminDetail(false)}
          price={activeAdminPrice}
        />
      </motion.div>
    </AppLayout>
  );
}

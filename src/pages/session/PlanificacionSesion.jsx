import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../../components/AppLayout";
import Modal from "../../components/Modal";
import api from "../../api/api";

/* ------------------ helpers ------------------ */

function pickPlanSession(sessions = []) {
  const list = (sessions || []).filter((s) => s.status === "PLANIFICACION");
  if (list.length === 0) return null;

  return list.sort((a, b) => {
    const da = new Date(a.dateTarget || a.createdAt).getTime();
    const db = new Date(b.dateTarget || b.createdAt).getTime();
    return db - da;
  })[0];
}

function badgeByStatus(status) {
  if (status === "ABIERTA") return "bg-green-500/10 text-green-300 border-green-500/20";
  if (status === "PLANIFICACION") return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
  if (status === "CERRADA") return "bg-zinc-500/10 text-zinc-300 border-white/10";
  return "bg-white/5 text-zinc-300 border-white/10";
}

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function moneyAR(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR");
}

function getVariantLabel(v) {
  const prod = v?.productId?.name || "Producto";
  const name = v?.nameVariant || "—";
  const unitBuy = v?.unitBuy || "—";
  const unitSale = v?.unitSale || "—";
  return `${prod} · ${name} · Compra: ${unitBuy} · Venta: ${unitSale}`;
}

function extractVariantFromItem(item) {
  const v = item?.variantId && typeof item.variantId === "object" ? item.variantId : null;

  const variantId = v?._id || item?.variantId || "";
  const productName = v?.productId?.name || "—";
  const variantName = v?.nameVariant || "—";

  const unitBuy = v?.unitBuy || item?.refBuyUnit || "—";
  const unitSale = v?.unitSale || "—";

  return { variantId, productName, variantName, unitBuy, unitSale };
}

function groupItemsByProduct(items = []) {
  const map = new Map();

  for (const it of items) {
    const v = it?.variantId && typeof it.variantId === "object" ? it.variantId : null;
    const productId = v?.productId?._id ? String(v.productId._id) : "unknown";
    const productName = v?.productId?.name || "Producto";

    if (!map.has(productId)) {
      map.set(productId, { productId, productName, items: [] });
    }
    map.get(productId).items.push(it);
  }

  return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
}

/**
 * Debounce por clave (itemId / sessionId) para autosave.
 */
function useDebouncedMapSaver() {
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
      // cleanup
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  return debounce;
}

/* ------------------ component ------------------ */

export default function PlanificacionSesion() {
  const navigate = useNavigate();
  const debounce = useDebouncedMapSaver();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [items, setItems] = useState([]);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal + variantes
  const [openModal, setOpenModal] = useState(false);
  const [variants, setVariants] = useState([]);
  const [q, setQ] = useState("");

  // multi-select
  const [selectedSet, setSelectedSet] = useState(() => new Set());
  const [addingMany, setAddingMany] = useState(false);

  // Presupuesto real autosave
  const [budgetReal, setBudgetReal] = useState("");
  const [budgetMsg, setBudgetMsg] = useState("");

  const planSession = useMemo(() => pickPlanSession(sessions), [sessions]);
  const sessionId = planSession?._id || null;

  const planItems = useMemo(() => {
    return (items || []).filter((it) => it?.origin === "PLANIFICADO");
  }, [items]);

  const groupedByProduct = useMemo(() => groupItemsByProduct(planItems), [planItems]);

  const plannedVariantIdsSet = useMemo(() => {
    const set = new Set();
    for (const it of planItems) {
      const vId =
        it?.variantId && typeof it.variantId === "object" ? it.variantId?._id : it?.variantId;
      if (vId) set.add(String(vId));
    }
    return set;
  }, [planItems]);

  const filteredVariants = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return variants;

    return variants.filter((v) => {
      const prod = (v?.productId?.name || "").toLowerCase();
      const name = (v?.nameVariant || "").toLowerCase();
      const unitBuy = (v?.unitBuy || "").toLowerCase();
      const unitSale = (v?.unitSale || "").toLowerCase();
      return prod.includes(term) || name.includes(term) || unitBuy.includes(term) || unitSale.includes(term);
    });
  }, [variants, q]);

  const totalRefD = useMemo(() => {
    return (planItems || []).reduce((acc, it) => {
      const v = Number(it?.refPrice);
      return acc + (Number.isFinite(v) ? v : 0);
    }, 0);
  }, [planItems]);

  /* ------------------ API loaders ------------------ */

  const loadSessions = async () => {
    const { data } = await api.get("/purchase-sessions/");
    return data?.ok ? data.sessions || [] : [];
  };

  const loadItems = async (sid) => {
    if (!sid) return [];
    const { data } = await api.get(`/purchase-sessions/${sid}/items`);
    return data?.items || [];
  };

  const loadVariants = async () => {
    const { data } = await api.get("/variants", { params: { active: "true" } });
    return data?.ok ? data.variants || [] : [];
  };

  const init = async () => {
    try {
      setLoading(true);
      setError("");

      const list = await loadSessions();
      setSessions(list);

      const ps = pickPlanSession(list);

      const vars = await loadVariants().catch(() => []);
      setVariants(vars);

      if (ps?._id) {
        const it = await loadItems(ps._id);
        setItems(it);

        // presupuesto real desde sesión (si existe)
        if (ps?.plannedBudgetReal != null) setBudgetReal(String(ps.plannedBudgetReal));
        else setBudgetReal("");
      } else {
        setItems([]);
        setBudgetReal("");
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Error cargando planificación");
      setSessions([]);
      setItems([]);
      setVariants([]);
      setBudgetReal("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    try {
      setError("");
      const list = await loadSessions();
      setSessions(list);

      const ps = pickPlanSession(list);
      if (ps?._id) {
        const it = await loadItems(ps._id);
        setItems(it);

        if (ps?.plannedBudgetReal != null) setBudgetReal(String(ps.plannedBudgetReal));
        // si es null, no lo pisamos (para no molestar mientras escribe)
      } else {
        setItems([]);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Error actualizando");
    }
  };

  /* ------------------ modal selection ------------------ */

  const openAddModal = () => {
    setError("");
    setQ("");
    setSelectedSet(new Set());
    setOpenModal(true);
  };

  const closeModal = () => {
    if (busy || addingMany) return;
    setOpenModal(false);
  };

  const toggleSelected = (variantId) => {
    const id = String(variantId);
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      for (const v of filteredVariants.slice(0, 200)) {
        const id = String(v._id);
        if (!plannedVariantIdsSet.has(id)) next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedSet(new Set());

  const addSelectedPlanificados = async () => {
    if (!sessionId) {
      setError("No hay sesión en PLANIFICACION.");
      return;
    }

    const ids = Array.from(selectedSet).filter((id) => id && !plannedVariantIdsSet.has(id));
    if (ids.length === 0) {
      setError("No hay variantes nuevas seleccionadas para agregar.");
      return;
    }

    try {
      setAddingMany(true);
      setError("");

      // Insertamos con plannedQty por defecto = 1 (puedes cambiar a null si prefieres)
      for (const vid of ids) {
        // eslint-disable-next-line no-await-in-loop
        await api.post(`/purchase-sessions/${sessionId}/items`, {
          variantId: vid,
          origin: "PLANIFICADO",
          plannedQty: 1,
          // refPrice se llenará automático si tu backend ya implementó D automático;
          // si no hay historial, quedará null y lo editará el admin.
        });
      }

      setOpenModal(false);
      const it = await loadItems(sessionId);
      setItems(it);
    } catch (e) {
      setError(e?.response?.data?.message || "Error agregando planificados");
    } finally {
      setAddingMany(false);
    }
  };

  /* ------------------ session actions ------------------ */

  const openSession = async () => {
    if (!sessionId) {
      setError("No hay sesión en PLANIFICACION para abrir.");
      return;
    }

    if (planItems.length === 0) {
      setError("No puedes abrir la sesión sin al menos 1 producto planificado.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      await api.post(`/purchase-sessions/${sessionId}/open`);
      await refresh();
      navigate("/session");
    } catch (e) {
      setError(e?.response?.data?.message || "Error abriendo sesión");
    } finally {
      setBusy(false);
    }
  };

  const removePlanificado = async (item) => {
    if (!sessionId) return;
    const itemId = item?._id;
    if (!itemId) return;

    try {
      setBusy(true);
      setError("");

      await api.delete(`/purchase-sessions/${sessionId}/items/${itemId}`);

      const it = await loadItems(sessionId);
      setItems(it);
    } catch (e) {
      setError(e?.response?.data?.message || "Error quitando planificado");
    } finally {
      setBusy(false);
    }
  };

  /* ------------------ inline autosave per item ------------------ */

  const patchPlanItem = async (itemId, payload) => {
    // Requiere endpoint backend:
    // PATCH /purchase-sessions/:id/items/:itemId  body: { plannedQty?, refPrice? }
    await api.patch(`/purchase-sessions/${sessionId}/items/${itemId}`, payload);
  };

  const setLocalItemField = (itemId, key, value) => {
    setItems((prev) =>
      (prev || []).map((it) => {
        if (it._id !== itemId) return it;
        return { ...it, [key]: value };
      })
    );
  };

  const onChangePlannedQty = (item, raw) => {
    const itemId = item?._id;
    if (!itemId) return;

    // Permitimos vacío mientras escribe
    setLocalItemField(itemId, "plannedQty", raw);

    debounce(`qty:${itemId}`, async () => {
      try {
        const n = asNumber(raw);
        if (n == null || n <= 0) return; // no guardamos inválidos
        await patchPlanItem(itemId, { plannedQty: n });
      } catch (e) {
        setError(e?.response?.data?.message || "Error guardando cantidad");
      }
    });
  };

  const onChangeRefPrice = (item, raw) => {
    const itemId = item?._id;
    if (!itemId) return;

    setLocalItemField(itemId, "refPrice", raw);

    debounce(`d:${itemId}`, async () => {
      try {
        const n = asNumber(raw);
        // refPrice puede ser null (vacío), guardamos null si está vacío
        if (raw === "" || raw == null) {
          await patchPlanItem(itemId, { refPrice: null });
          return;
        }
        if (n == null || n < 0) return;
        await patchPlanItem(itemId, { refPrice: n });
      } catch (e) {
        setError(e?.response?.data?.message || "Error guardando D");
      }
    });
  };

  /* ------------------ presupuesto real autosave ------------------ */

  const saveBudgetAuto = (raw) => {
    if (!sessionId) return;

    debounce(`budget:${sessionId}`, async () => {
      try {
        const n = asNumber(raw);
        if (raw === "" || raw == null) {
          // si quieres permitir borrar, guarda null:
          await api.patch(`/purchase-sessions/${sessionId}/budget`, {
            plannedBudgetReal: null,
            plannedBudgetRef: totalRefD,
          });
          setBudgetMsg("Presupuesto guardado.");
          setTimeout(() => setBudgetMsg(""), 1200);
          return;
        }

        if (n == null || n < 0) return;

        await api.patch(`/purchase-sessions/${sessionId}/budget`, {
          plannedBudgetReal: n,
          plannedBudgetRef: totalRefD, // cache informativo
        });

        setBudgetMsg("Presupuesto guardado.");
        setTimeout(() => setBudgetMsg(""), 1200);
      } catch (e) {
        setBudgetMsg(e?.response?.data?.message || "Error guardando presupuesto.");
        setTimeout(() => setBudgetMsg(""), 1800);
      }
    }, 700);
  };

  const onChangeBudgetReal = (raw) => {
    setBudgetReal(raw);
    saveBudgetAuto(raw);
  };

  /* ------------------ render ------------------ */

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-zinc-400">Cargando planificación…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-4 pb-24 md:pb-0"
      >
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Lista de compras</p>
              <p className="text-xs text-zinc-500 mt-1">
                Selecciona variantes, define cantidad de compra y ajusta “Tot. Est” si no hay historial.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
              >
                Volver
              </Link>

              <button
                onClick={refresh}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
              >
                Actualizar
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="text-xs text-zinc-400">
              {planSession ? (
                <p>
                  Fecha: <span className="text-zinc-200">{planSession.dateKey || "—"}</span>
                </p>
              ) : (
                <p className="text-zinc-300">
                  No hay sesión en <span className="text-zinc-200">PLANIFICACION</span>. Crea una sesión nueva.
                </p>
              )}
            </div>

            <span className={`text-[11px] rounded-lg border px-2 py-1 ${badgeByStatus(planSession?.status)}`}>
              {planSession?.status || "—"}
            </span>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div>
          )}
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            disabled={!planSession || busy}
            onClick={openAddModal}
            className="rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Crear lista de compras
          </button>

          <button
            disabled={!planSession || busy}
            onClick={openSession}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-center hover:bg-white/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? "Procesando…" : "Abrir sesión"}
          </button>
        </div>

        {/* Listado Planificados (desktop) */}
        {planSession && planItems.length > 0 && (
          <div className="hidden md:block rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-xs text-zinc-500">
              <div className="col-span-5">PRODUCTO</div>
              <div className="col-span-2">VARIANTE</div>
              <div className="col-span-2">CANTIDAD</div>
              <div className="col-span-1">TOTL. EST.</div>
              <div className="col-span-1 text-right">ACCION</div>
            </div>

            <div className="divide-y divide-white/10">
              {planItems.map((it) => {
                const info = extractVariantFromItem(it);

                return (
                  <div key={it._id} className="px-4 py-3">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      {/* Producto + unidades */}
                      <div className="col-span-5 min-w-0">
                        <p className="text-sm font-semibold text-zinc-200 truncate">{info.productName}</p>
                        <p className="text-[11px] text-zinc-500 mt-1 truncate">
                          {info.variantName} · Compra:{" "}
                          <span className="text-zinc-200">{info.unitBuy}</span> · Venta:{" "}
                          <span className="text-zinc-200">{info.unitSale}</span>
                        </p>
                      </div>

                      {/* Variante */}
                      <div className="col-span-2">
                        <p className="text-sm text-zinc-200 truncate">{info.variantName}</p>
                      </div>

                      {/* Cantidad compra */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={it?.plannedQty ?? ""}
                            onChange={(e) => onChangePlannedQty(it, e.target.value)}
                            className="w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20 transition text-sm"
                            inputMode="decimal"
                            placeholder="Ej: 1"
                          />
                          <span className="text-xs text-zinc-400 w-14 text-right">{info.unitBuy}</span>
                        </div>
                      </div>

                      {/* TOTAL STIMADO */}
                      <div className="col-span-1">
                        <input
                          value={it?.refPrice ?? ""}
                          onChange={(e) => onChangeRefPrice(it, e.target.value)}
                          className="w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20 transition text-sm"
                          inputMode="decimal"
                          placeholder="Vacío"
                          title="Total (referencial)"
                        />
                      </div>

                      {/* Acción */}
                      <div className="col-span-1 flex justify-end">
                        <button
                          disabled={busy}
                          onClick={() => removePlanificado(it)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition disabled:opacity-60"
                          title="Quitar de planificados"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Listado Planificados (mobile) */}
        {planSession && planItems.length > 0 && (
          <div className="md:hidden space-y-3">
            {groupedByProduct.map((group) => (
              <div key={group.productId} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-zinc-200 truncate">{group.productName}</p>
                  <span className="text-[11px] rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-300">
                    {group.items.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.items.map((it) => {
                    const info = extractVariantFromItem(it);

                    return (
                      <div key={it._id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-200 truncate">{info.variantName}</p>
                          <p className="text-[11px] text-zinc-500 mt-1 truncate">
                            Compra: <span className="text-zinc-200">{info.unitBuy}</span> · Venta:{" "}
                            <span className="text-zinc-200">{info.unitSale}</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[11px] text-zinc-500">Cantidad (compra)</p>
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                value={it?.plannedQty ?? ""}
                                onChange={(e) => onChangePlannedQty(it, e.target.value)}
                                className="w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20 transition text-sm"
                                inputMode="decimal"
                                placeholder="Ej: 1"
                              />
                              <span className="text-xs text-zinc-400 w-14 text-right">{info.unitBuy}</span>
                            </div>
                          </div>

                          <div>
                            <p className="text-[11px] text-zinc-500">Tot. (estimado)</p>
                            <input
                              value={it?.refPrice ?? ""}
                              onChange={(e) => onChangeRefPrice(it, e.target.value)}
                              className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20 transition text-sm"
                              inputMode="decimal"
                              placeholder="Vacío"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            disabled={busy}
                            onClick={() => removePlanificado(it)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition disabled:opacity-60"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {planSession && planItems.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm">Aún no hay items planificados.</p>
            <p className="text-xs text-zinc-500 mt-2">Usa “Crear lista de compras” para seleccionar variantes.</p>
          </div>
        )}

        {/* Resumen presupuesto */}
        {planSession && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold">Resumen de presupuesto</p>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-zinc-500">Presupuesto sugerido (Σ Tot.)</p>
                <p className="text-lg font-semibold text-zinc-100 mt-1">{moneyAR(totalRefD)}</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  ARS
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <label className="text-xs text-zinc-500">Presupuesto real a llevar (ARS)</label>
                <input
                  value={budgetReal}
                  onChange={(e) => onChangeBudgetReal(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                  inputMode="decimal"
                  placeholder="Ej: 45000"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Guardado automático. Se usará luego para cuadrar gastos.
                </p>

                {budgetMsg ? <p className="mt-2 text-[12px] text-zinc-300">{budgetMsg}</p> : null}
              </div>
            </div>
          </div>
        )}

        {/* Modal: seleccionar variantes (multi) */}
        <Modal open={openModal} onClose={closeModal} title="Crear lista de compras">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Buscar variante</p>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                placeholder="Buscar por producto, variante o unidad…"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
              >
                Seleccionar visibles
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
              >
                Limpiar selección
              </button>

              <div className="ml-auto text-xs text-zinc-400">
                Seleccionadas: <span className="text-zinc-200">{selectedSet.size}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-2 max-h-80 overflow-auto">
              {filteredVariants.length === 0 ? (
                <p className="text-sm text-zinc-400 p-2">No hay variantes que coincidan.</p>
              ) : (
                <div className="space-y-2">
                  {filteredVariants.slice(0, 200).map((v) => {
                    const id = String(v._id);
                    const label = getVariantLabel(v);
                    const checked = selectedSet.has(id);
                    const alreadyPlanned = plannedVariantIdsSet.has(id);

                    return (
                      <label
                        key={id}
                        className={`w-full block rounded-xl border px-3 py-2 text-sm transition cursor-pointer ${
                          checked ? "border-white/30 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                        } ${alreadyPlanned ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1 accent-white"
                            checked={checked}
                            disabled={alreadyPlanned}
                            onChange={() => toggleSelected(id)}
                          />
                          <div className="min-w-0">
                            <p className="text-zinc-200">{label}</p>
                            <p className="text-[11px] text-zinc-500 mt-1">
                              {alreadyPlanned ? "Ya está en la lista" : "Se agregará a planificados"}
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              disabled={addingMany || selectedSet.size === 0}
              onClick={addSelectedPlanificados}
              className="w-full rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium text-center disabled:opacity-60"
            >
              {addingMany ? "Agregando…" : "Agregar seleccionadas"}
            </button>
          </div>
        </Modal>

        {/* MOBILE: Barra fija inferior */}
        <div className="md:hidden fixed left-0 right-0 bottom-0 z-40">
          <div className="mx-auto max-w-[920px] px-3 pb-3">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  Planificados: <span className="text-zinc-200 font-semibold">{planItems.length}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={!planSession || busy}
                    onClick={openAddModal}
                    className="rounded-xl bg-white text-zinc-950 px-3 py-2 text-xs font-medium disabled:opacity-60"
                  >
                    Agregar
                  </button>

                  <button
                    disabled={!planSession || busy}
                    onClick={openSession}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition disabled:opacity-60"
                  >
                    Abrir
                  </button>
                </div>
              </div>

              {error ? <p className="mt-2 text-[11px] text-red-200">{error}</p> : null}
            </div>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}

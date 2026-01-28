import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/Modal";
import api from "../../../api/api";

function toNumberSafe(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim();
  if (!s) return NaN;
  return Number(s.replace(",", "."));
}

function fmtUnit(unit) {
  const u = String(unit || "").trim();
  return u || "KG";
}

function formatARS(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(x);
}

export default function ConfirmarCompraModal({
  open,
  onClose,
  sessionId,
  item,
  defaultQty = 1,
  onSuccess,
}) {
  const product = item?.variantId?.productId;
  const variant = item?.variantId;

  // buyUnit viene de variante (backend ya lo permite)
  const buyUnit = fmtUnit(variant?.unitBuy);

  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  const [form, setForm] = useState({
    supplierId: "",
    qty: "",
    unitCost: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const locked = saving || !!successMsg;

  useEffect(() => {
    if (!open || !item) return;

    setError("");
    setSuccessMsg("");
    setSaving(false);

    setForm({
      supplierId: "",
      qty: String(defaultQty ?? 1),
      unitCost: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?._id]);

  useEffect(() => {
    if (!open) return;
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      setError("");
      const { data } = await api.get("/suppliers?active=true");
      const list = data?.suppliers || data?.items || data?.data || [];
      setSuppliers(Array.isArray(list) ? list : []);
    } catch {
      setSuppliers([]);
      setError("No se pudieron cargar proveedores.");
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const isCaja = buyUnit === "CAJA";

  const qtyNum = useMemo(() => toNumberSafe(form.qty), [form.qty]);
  const unitCostNum = useMemo(() => toNumberSafe(form.unitCost), [form.unitCost]);

  const totalCost = useMemo(() => {
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return null;
    if (!Number.isFinite(unitCostNum) || unitCostNum <= 0) return null;
    return qtyNum * unitCostNum;
  }, [qtyNum, unitCostNum]);

  const isValid = useMemo(() => {
    if (!form.supplierId) return false;
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return false;
    if (!Number.isFinite(unitCostNum) || unitCostNum <= 0) return false;

    if (isCaja && !Number.isInteger(qtyNum)) return false;
    return true;
  }, [form.supplierId, qtyNum, unitCostNum, isCaja]);

  const closeAfter = (ms = 900) => {
    window.setTimeout(() => onClose?.(), ms);
  };

  const submit = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      if (!form.supplierId) {
        setError("Selecciona un proveedor.");
        return;
      }

      if (!isValid) {
        setError(isCaja ? "Cantidad inválida (para CAJA debe ser entero)." : "Cantidad o costo inválidos.");
        return;
      }

      const basePayload = {
        supplierId: form.supplierId,
        unitCost: unitCostNum,
        buyUnit, // ✅ siempre el de la variante
      };

      // ✅ CAJA => N lotes (1 por caja)
      if (isCaja) {
        const n = Math.floor(qtyNum);

        for (let i = 0; i < n; i++) {
          // eslint-disable-next-line no-await-in-loop
          const { data } = await api.post(
            `/purchase-sessions/${sessionId}/items/${item._id}/confirm`,
            { ...basePayload, qty: 1 }
          );
          if (!data?.ok) throw new Error(data?.message || "No se pudo confirmar una caja.");
        }

        setSuccessMsg(`Compra confirmada: ${n} caja(s).`);
        onSuccess?.({ ok: true, createdLots: n });
        closeAfter(900);
        return;
      }

      // ✅ Otros => 1 request con qty
      const { data } = await api.post(
        `/purchase-sessions/${sessionId}/items/${item._id}/confirm`,
        { ...basePayload, qty: qtyNum }
      );

      if (!data?.ok) throw new Error(data?.message || "No se pudo confirmar la compra.");

      setSuccessMsg("Compra confirmada.");
      onSuccess?.(data);
      closeAfter(850);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Error al confirmar la compra.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={locked ? () => {} : onClose}
      title={`Comprar · ${product?.name || "Producto"}`}
    >
      <div className="space-y-4">
        {/* Producto */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-200 truncate">
              {product?.name || "—"}
            </p>
            <p className="text-xs text-zinc-500 mt-1 truncate">
              {variant?.nameVariant || "—"} · Unidad compra:{" "}
              <span className="text-zinc-200">{buyUnit}</span>
            </p>
          </div>

          {totalCost != null && (
            <div className="text-right flex-shrink-0">
              <p className="text-[11px] text-zinc-500">Costo total</p>
              <p className="text-sm font-semibold text-zinc-100">
                {formatARS(totalCost)}
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
            {successMsg}
          </div>
        )}

        {/* Proveedor */}
        <div>
          <label className="text-xs text-zinc-300">Proveedor</label>
          <select
            value={form.supplierId}
            onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
            className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
            disabled={loadingSuppliers || locked}
          >
            <option value="">
              {loadingSuppliers ? "Cargando..." : "Seleccionar proveedor"}
            </option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.nickname || "Proveedor"}
              </option>
            ))}
          </select>
        </div>

        {/* Cantidad + Costo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-300">
              Cantidad ({buyUnit})
            </label>
            <input
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
              inputMode={isCaja ? "numeric" : "decimal"}
              placeholder={isCaja ? "Ej: 2" : "Ej: 10"}
              disabled={locked}
            />
            {isCaja && (
              <p className="text-[11px] text-zinc-500 mt-1">
                CAJA: ingresar número entero de cajas.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-zinc-300">
              Costo unitario ({buyUnit})
            </label>
            <input
              value={form.unitCost}
              onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
              className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
              inputMode="decimal"
              placeholder="Ej: 6500"
              disabled={locked}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={locked}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 transition disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            onClick={submit}
            disabled={!isValid || saving || !!successMsg}
            className="flex-1 rounded-xl bg-white text-zinc-950 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Confirmando..." : "Confirmar compra"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/*
// src/pages/session/components/ConfirmarCompraModal.jsx
import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/Modal";
import api from "../../../api/api";

function toNumberSafe(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim();
  if (!s) return NaN;
  return Number(s.replace(",", "."));
}

function defaultBuyUnitFromVariant(variant) {
  const ub = String(variant?.unitBuy || "").trim();
  if (ub) return ub;
  const us = String(variant?.unitSale || "").trim();
  if (us) return us;
  return "KG";
}

function formatARS(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(x);
}

async function runInBatches(tasks, batchSize = 5) {
  for (let i = 0; i < tasks.length; i += batchSize) {
    const chunk = tasks.slice(i, i + batchSize).map((fn) => fn());
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(chunk);
  }
}


function pickPlannedQty(item) {
  if (!item) return NaN;

  const candidates = [
    item?.plan?.qty,
    item?.planQty,
    item?.plannedQty,
    item?.qtyPlanned,
    item?.qtyToBuy,
    item?.qty,
    item?.buyQty,
    item?.suggestedQty,
  ];

  for (const v of candidates) {
    const n = toNumberSafe(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return NaN;
}

export default function ConfirmarCompraModal({
  open,
  onClose,
  sessionId,
  item,
  onSuccess,
}) {
  const product = item?.variantId?.productId;
  const variant = item?.variantId;

  const buyUnit = useMemo(() => defaultBuyUnitFromVariant(variant), [variant]);
  const isCaja = buyUnit === "CAJA";

  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  const [form, setForm] = useState({
    supplierId: "",
    qty: "",
    totalCost: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const locked = saving || !!successMsg;

  // Reset al abrir + ✅ precargar qty desde planificación
  useEffect(() => {
    if (!open || !item) return;

    setError("");
    setSuccessMsg("");
    setSaving(false);

    const planned = pickPlannedQty(item);

    const qtyDefault = Number.isFinite(planned)
      ? isCaja
        ? String(Math.max(1, Math.floor(planned))) // CAJA => entero
        : String(planned)
      : "";

    setForm({
      supplierId: "",
      qty: qtyDefault,
      totalCost: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?._id, buyUnit]);

  // Cargar proveedores al abrir
  useEffect(() => {
    if (!open) return;
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      setError("");

      const { data } = await api.get("/suppliers?active=true");
      const list = data?.suppliers || data?.items || data?.data || [];
      setSuppliers(Array.isArray(list) ? list : []);
    } catch {
      setSuppliers([]);
      setError("No se pudieron cargar proveedores.");
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const parsed = useMemo(() => {
    const qty = toNumberSafe(form.qty);
    const totalCost = toNumberSafe(form.totalCost);
    const qtyInt = Math.floor(qty);

    const qtyValid =
      Number.isFinite(qty) &&
      qty > 0 &&
      (!isCaja || (Number.isInteger(qty) && qty === qtyInt));

    const totalValid = Number.isFinite(totalCost) && totalCost > 0;

    const unitCost =
      qtyValid && totalValid ? totalCost / (isCaja ? qtyInt : qty) : NaN;

    return { qty, qtyInt, totalCost, qtyValid, totalValid, unitCost };
  }, [form.qty, form.totalCost, isCaja]);

  const isValid = useMemo(() => {
    if (!form.supplierId) return false;
    if (!parsed.qtyValid) return false;
    if (!parsed.totalValid) return false;
    if (!Number.isFinite(parsed.unitCost) || parsed.unitCost <= 0) return false;
    return true;
  }, [form.supplierId, parsed]);

  const closeAfter = (ms = 1100) => {
    window.setTimeout(() => {
      onClose?.();
    }, ms);
  };

  const submit = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      if (!form.supplierId) {
        setError("Selecciona un proveedor.");
        return;
      }

      if (!isValid) {
        setError("Completa cantidad y costo total correctamente.");
        return;
      }

      const basePayload = {
        supplierId: form.supplierId,
        buyUnit, // fijo por variante
        unitCost: parsed.unitCost,
      };

      if (isCaja) {
        const n = parsed.qtyInt;

        const tasks = Array.from({ length: n }).map(() => async () => {
          const { data } = await api.post(
            `/purchase-sessions/${sessionId}/items/${item._id}/confirm`,
            { ...basePayload, qty: 1 }
          );
          if (!data?.ok) throw new Error(data?.message || "No se pudo confirmar una caja.");
          return data;
        });

        await runInBatches(tasks, 5);

        setSuccessMsg(
          `Compra confirmada: ${n} caja(s). Costo total: ${formatARS(parsed.totalCost)}.`
        );
        onSuccess?.({ ok: true, createdLots: n });

        closeAfter(1200);
        return;
      }

      const { data } = await api.post(
        `/purchase-sessions/${sessionId}/items/${item._id}/confirm`,
        { ...basePayload, qty: parsed.qty }
      );

      if (!data?.ok) throw new Error(data?.message || "No se pudo confirmar la compra.");

      setSuccessMsg(`Compra confirmada. Total: ${formatARS(parsed.totalCost)}.`);
      onSuccess?.(data);

      closeAfter(1100);
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Error al confirmar la compra.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={locked ? () => {} : onClose}
      title={`Comprar · ${product?.name || "Producto"}`}
    >
      <div className="space-y-4">
        
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold truncate">{product?.name || "—"}</p>
          <p className="text-xs text-zinc-400 mt-1 truncate">
            {variant?.nameVariant || "—"}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Unidad de compra: <span className="text-zinc-200">{buyUnit}</span>
            {isCaja ? (
              <span className="text-zinc-500">
                {" "}
                · (1 lote por caja)
              </span>
            ) : null}
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
            {successMsg}
          </div>
        )}

        
        <div>
          <label className="text-xs text-zinc-300">Proveedor</label>
          <select
            value={form.supplierId}
            onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
            className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
            disabled={loadingSuppliers || locked}
          >
            <option value="">
              {loadingSuppliers ? "Cargando..." : "Seleccionar proveedor"}
            </option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.nickname || "Proveedor"}
              </option>
            ))}
          </select>
        </div>

        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-300">
              Cantidad ({buyUnit})
            </label>
            <input
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
              inputMode={isCaja ? "numeric" : "decimal"}
              placeholder={isCaja ? "Ej: 1, 2, 3..." : "Ej: 10"}
              disabled={locked}
            />
            {isCaja && form.qty && !parsed.qtyValid && (
              <p className="text-[11px] text-red-200/80 mt-1">
                Para CAJA la cantidad debe ser un entero (1, 2, 3...).
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-zinc-300">Costo total (ARS)</label>
            <input
              value={form.totalCost}
              onChange={(e) => setForm({ ...form, totalCost: e.target.value })}
              className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
              inputMode="decimal"
              placeholder="Ej: 18500"
              disabled={locked}
            />
          </div>
        </div>

        
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs text-zinc-400">
            Unitario estimado:{" "}
            <span className="text-zinc-200">
              {Number.isFinite(parsed.unitCost) ? formatARS(parsed.unitCost) : "—"}
            </span>{" "}
            por {isCaja ? "caja" : buyUnit.toLowerCase()}
          </p>
        </div>

        
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={locked}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 transition disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            onClick={submit}
            disabled={!isValid || saving || !!successMsg}
            className="flex-1 rounded-xl bg-white text-zinc-950 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Confirmando..." : "Confirmar compra"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
*/
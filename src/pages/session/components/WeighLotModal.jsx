import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/Modal";
import { weighLot } from "../api/lots";

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

export default function WeighLotModal({ open, onClose, lot, onSuccess }) {
  const [netWeightKg, setNetWeightKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [newSalePrice, setNewSalePrice] = useState(null);

  const product = lot?.variantId?.productId;
  const variant = lot?.variantId;

  const productName = product?.name || "Producto";
  const productImg = product?.imageUrl || "";
  const variantName = variant?.nameVariant || "—";

  useEffect(() => {
    if (!open) return;
    setNetWeightKg("");
    setSaving(false);
    setError("");
    setSuccessMsg("");
    setNewSalePrice(null);
  }, [open]);

  const isValid = useMemo(() => {
    const w = Number(netWeightKg);
    return Number.isFinite(w) && w > 0;
  }, [netWeightKg]);

  const submit = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");
      setNewSalePrice(null);

      const w = Number(netWeightKg);
      const data = await weighLot(lot._id, w);

      if (!data?.ok) throw new Error("No se pudo registrar el pesaje.");

      // Si el backend devuelve dailyPrice (como tu Postman), lo mostramos
      const salePrice = data?.dailyPrice?.salePrice ?? null;
      if (salePrice !== null) setNewSalePrice(salePrice);

      setSuccessMsg("Pesaje registrado correctamente.");
      onSuccess?.(data);

      setTimeout(() => onClose(), 1200);
    } catch (e) {
      const status = e?.response?.status;

      if (status === 403) {
        setError("No autorizado: solo ADMIN puede registrar el pesaje.");
      } else if (status === 409) {
        setError(
          e?.response?.data?.message || "Conflicto: el lote no requiere pesaje."
        );
      } else if (status === 404) {
        setError("Lote no encontrado (404). Verifica que el lote exista.");
      } else {
        setError(e?.response?.data?.message || e?.message || "Error al pesar lote.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving || successMsg ? () => {} : onClose}
      title="Pesar caja"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
            {successMsg}
            {newSalePrice !== null && (
              <div className="text-xs text-green-200/90 mt-1">
                Nuevo precio venta: Bs {formatMoney(newSalePrice)} / KG
              </div>
            )}
          </div>
        )}

        {/* Card del lote (con imagen + datos) */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-white/10 overflow-hidden flex-shrink-0 border border-white/10">
              {productImg ? (
                <img
                  src={productImg}
                  alt={productName}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{productName}</p>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">
                {variantName} · CAJA
              </p>
              <p className="text-[11px] text-zinc-500 mt-1 truncate">
                Proveedor: {lot?.supplierId?.nickname || "—"} · Comprado por:{" "}
                {lot?.boughtBy?.username || "—"}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 mt-2">
            Lote: <span className="text-zinc-400">{lot?._id}</span>
          </p>
        </div>

        <div>
          <label className="text-xs text-zinc-300">Peso neto (Kg)</label>
          <input
            value={netWeightKg}
            onChange={(e) => setNetWeightKg(e.target.value)}
            className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
            inputMode="decimal"
            placeholder="Ej: 18.6"
            disabled={saving || !!successMsg}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving || !!successMsg}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 transition disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            onClick={submit}
            disabled={!isValid || saving || !!successMsg}
            className="flex-1 rounded-xl bg-white text-zinc-950 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar pesaje"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

import Modal from "../../../components/Modal";

function formatARS(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AdminPriceDetailModal({ open, onClose, price }) {
  const v = price?.variantId;
  const prod = v?.productId?.name || "Producto";
  const varName = v?.nameVariant || "—";

  const boughtQty = Number(price?.purchase?.boughtQty || 0);
  const boughtTotal = Number(price?.purchase?.boughtTotal || 0);

  const unitBuy = v?.unitBuy || "—";
  const unitSale = v?.unitSale || price?.unitSale || "KG";

  const unitCostBuy =
    boughtQty > 0 && boughtTotal > 0 ? boughtTotal / boughtQty : null;

  return (
    <Modal open={open} onClose={onClose} title="Detalle">
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold">{prod}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {varName} · compra {unitBuy} · vende {unitSale}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-zinc-500">Cantidad comprada</p>
            <p className="text-base font-semibold tabular-nums">
              {boughtQty > 0 ? boughtQty : "—"} {unitBuy}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-zinc-500">Total pagado</p>
            <p className="text-base font-semibold tabular-nums">
              {boughtTotal > 0 ? formatARS(boughtTotal) : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-zinc-500">Costo por unidad comprada</p>
            <p className="text-base font-semibold tabular-nums">
              {unitCostBuy != null ? formatARS(unitCostBuy) : "—"} / {unitBuy}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-zinc-500">Debe vender (precio del día)</p>
            <p className="text-base font-semibold tabular-nums">
              {price?.salePrice != null ? formatARS(price.salePrice) : "—"} / {unitSale}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-white text-zinc-950 py-2.5 text-sm font-medium"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}

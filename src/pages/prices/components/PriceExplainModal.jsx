import Modal from "../../../components/Modal";

function formatARS(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function PriceExplainModal({ open, onClose, price, showCosts = false }) {
  const lot = price?.sourceLotId;

  const kg = Number(lot?.netWeightKg);
  const unitCost = Number(lot?.unitCost);
  const costPerKg =
    Number.isFinite(kg) && kg > 0 && Number.isFinite(unitCost) ? unitCost / kg : null;

  return (
    <Modal open={open} onClose={onClose} title="Detalle del precio">
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold">Cómo se formó el precio</p>
          <p className="text-xs text-zinc-500 mt-1">
            Se publica el precio de venta del día. El costo y lote son visibles solo para ADMIN.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {showCosts && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] text-zinc-500">Costo final</p>
              <p className="text-base font-semibold">{formatARS(price?.costFinal)}</p>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-zinc-500">Precio de venta</p>
            <p className="text-base font-semibold">{formatARS(price?.salePrice)}</p>
          </div>
        </div>

        {showCosts && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-semibold">Lote de referencia</p>
            <p className="text-xs text-zinc-500 mt-1">
              Este lote quedó como trazabilidad del costo final.
            </p>

            <div className="mt-2 text-sm space-y-1">
              <p>
                <span className="text-zinc-400">UnitCost:</span> {formatARS(lot?.unitCost)}
              </p>
              <p>
                <span className="text-zinc-400">Peso neto:</span> {lot?.netWeightKg ?? "—"} kg
              </p>
              <p>
                <span className="text-zinc-400">Costo/Kg del lote:</span>{" "}
                {costPerKg != null ? formatARS(costPerKg) : "—"}
              </p>
            </div>
          </div>
        )}

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

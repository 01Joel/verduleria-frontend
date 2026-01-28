import { useMemo } from "react";

function formatARS(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPct(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function badgeByStatus(status) {
  if (status === "LISTO") return "bg-green-500/10 text-green-300 border-green-500/20";
  if (status === "PARCIAL") return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
  return "bg-zinc-500/10 text-zinc-300 border-white/10";
}

/* -------------------- helpers imagen -------------------- */
function withBust(url, seed) {
  if (!url) return "";
  const v = seed ? new Date(seed).getTime() : Date.now();
  return url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`;
}

function resolvePriceImage(price) {
  const variant = price?.variantId && typeof price.variantId === "object" ? price.variantId : null;
  const product = variant?.productId || null;

  const url = variant?.imageUrl || product?.imageUrl || "";
  const seed = variant?.updatedAt || product?.updatedAt || price?.updatedAt || null;

  return url ? withBust(url, seed) : "";
}
/* -------------------------------------------------------- */

export default function DailyPriceCard({ price, onExplain, showCosts = false }) {
  const variant = price?.variantId;
  const product = variant?.productId;

  const imgSrc = resolvePriceImage(price);

  const title = product?.name || "Producto";
  const subtitle = `${variant?.nameVariant || "—"} · ${variant?.unitSale || "—"}`;

  const status = price?.status || "PENDIENTE";

  const costFinal = price?.costFinal;
  const salePrice = price?.salePrice;
  const marginPct = price?.marginPct;

  const costText = useMemo(() => formatARS(costFinal), [costFinal]);
  const saleText = useMemo(() => formatARS(salePrice), [salePrice]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex gap-3">
        {/* Imagen */}
        <div className="h-16 w-16 rounded-2xl bg-white/10 overflow-hidden flex-shrink-0 border border-white/10">
          {imgSrc ? (
            <img src={imgSrc} alt={title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-full w-full bg-white/5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{title}</p>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">{subtitle}</p>
            </div>

            <span className={`text-[11px] rounded-lg border px-2 py-1 ${badgeByStatus(status)}`}>
              {status}
            </span>
          </div>

          {/* Precio de venta */}
          <div className="mt-3">
            <p className="text-[11px] text-zinc-500">Precio de venta</p>
            <p className="text-xl font-semibold leading-tight">{saleText}</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              por {price?.unitSale || variant?.unitSale || "KG"}
            </p>
          </div>
        </div>
      </div>

      {/* Detalle (solo ADMIN) */}
      {showCosts && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <p className="text-[11px] text-zinc-500">Costo final</p>
            <p className="text-sm font-medium">{costText}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <p className="text-[11px] text-zinc-500">Margen aplicado</p>
            <p className="text-sm font-medium">{formatPct(marginPct)}</p>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onExplain?.(price)}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 transition"
        >
          Ver detalle
        </button>
      </div>
    </div>
  );
}

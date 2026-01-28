// src/pages/session/components/ItemCard.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../../api/api";
import ConfirmarCompraModal from "./ConfirmarCompraModal";

function withBust(url, seed) {
  if (!url) return "";
  const v = seed ? new Date(seed).getTime() : Date.now();
  return url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`;
}

function resolveItemImage(item) {
  const variant =
    item?.variantId && typeof item.variantId === "object" ? item.variantId : null;
  const product = variant?.productId || null;

  const url = variant?.imageUrl || product?.imageUrl || "";
  const seed = variant?.updatedAt || product?.updatedAt || item?.updatedAt || null;

  return url ? withBust(url, seed) : "";
}

function getMeId() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return u?.id || u?._id || null;
  } catch {
    return null;
  }
}

function defaultBuyUnitFromVariant(variant) {
  const ub = String(variant?.unitBuy || "").trim();
  if (ub) return ub;
  const us = String(variant?.unitSale || "").trim();
  if (us) return us;
  return "KG";
}

function fmtQty(n) {
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
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

export default function ItemCard({
  session,
  item,
  actionsEnabled,
  onReload,
  number,
  numberClass,
}) {
  const product = item?.variantId?.productId;
  const variant = item?.variantId;

  const imgSrc = resolveItemImage(item);

  const [openBuy, setOpenBuy] = useState(false);

  const [localState, setLocalState] = useState(item.state);
  const [localReserveExpiresAt, setLocalReserveExpiresAt] = useState(
    item.reserveExpiresAt
  );
  const [localReservedBy, setLocalReservedBy] = useState(item.reservedBy || null);

  const [reserveMinutes, setReserveMinutes] = useState(15);
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState("");

  useEffect(() => {
    setLocalState(item.state);
    setLocalReserveExpiresAt(item.reserveExpiresAt);
    setLocalReservedBy(item.reservedBy || null);
  }, [item.state, item.reserveExpiresAt, item.reservedBy]);

  const isBought = localState === "COMPRADO";
  const isReserved = !!localReserveExpiresAt;

  const meId = useMemo(() => getMeId(), []);

  const reservedById =
    localReservedBy?._id ||
    localReservedBy?.id ||
    (typeof localReservedBy === "string" ? localReservedBy : null);

  const isReservedByMe = isReserved && meId && reservedById && reservedById === meId;

  const canReserve = actionsEnabled && !isReserved && !isBought;
  const canBuy = actionsEnabled && !isBought && (!isReserved || isReservedByMe);

  const reserve = async () => {
    if (!canReserve || reserving) return;

    try {
      setReserving(true);
      setReserveError("");

      const { data } = await api.post(
        `/purchase-sessions/${session._id}/items/${item._id}/reserve`,
        { minutes: reserveMinutes }
      );

      const updated = data?.item || data?.updatedItem || null;

      if (updated) {
        setLocalReserveExpiresAt(updated.reserveExpiresAt || null);
        setLocalReservedBy(updated.reservedBy || (meId ? { _id: meId } : null));
        setLocalState(updated.state || localState);
      } else {
        const exp = new Date(Date.now() + reserveMinutes * 60 * 1000).toISOString();
        setLocalReserveExpiresAt(exp);
        setLocalReservedBy(meId ? { _id: meId } : null);
      }

      onReload();
    } catch (e) {
      setReserveError(e?.response?.data?.message || "Error al reservar.");
    } finally {
      setReserving(false);
    }
  };

  // ✅ Campos reales
  const plannedQty = Number(item?.plannedQty);
  const buyUnit = defaultBuyUnitFromVariant(variant);
  const plannedText =
    Number.isFinite(plannedQty) && plannedQty > 0 ? `${fmtQty(plannedQty)} ${buyUnit}` : "—";

  const filaD = Number(item?.refPrice);
  const filaDText = Number.isFinite(filaD) && filaD >= 0 ? formatARS(filaD) : "—";

  const boughtQty = Number(item?.purchase?.boughtQty || 0);
  const boughtTotal = Number(item?.purchase?.boughtTotal || 0);

  const boughtQtyText =
    Number.isFinite(boughtQty) && boughtQty > 0 ? `${fmtQty(boughtQty)} ${buyUnit}` : "—";

  const boughtTotalText =
    Number.isFinite(boughtTotal) && boughtTotal > 0 ? formatARS(boughtTotal) : "—";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        {/* Numeración */}
        <div className="flex-shrink-0">
          <span
            className={`inline-flex items-center justify-center h-8 w-8 rounded-xl border text-xs font-semibold ${
              numberClass || "bg-white/5 text-zinc-200 border-white/10"
            }`}
            title="Orden en la lista"
          >
            {number || "—"}
          </span>
        </div>

        {/* Imagen */}
        <div className="h-12 w-12 rounded-xl bg-white/10 overflow-hidden flex-shrink-0 border border-white/10">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={product?.name || "Producto"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold truncate">{product?.name || "—"}</p>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isBought && (
                <span className="text-[10px] rounded-lg bg-green-500/10 text-green-300 px-2 py-1">
                  Comprado
                </span>
              )}
              {!isBought && isReserved && (
                <span className="text-[10px] rounded-lg bg-yellow-500/10 text-yellow-300 px-2 py-1">
                  {isReservedByMe ? "Reservado (tú)" : "Reservado"}
                </span>
              )}
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
            {variant?.nameVariant || "—"} · Venta: {variant?.unitSale || "—"}
          </p>

          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
            <p className="text-[11px] text-zinc-500">
              Planificado: <span className="text-zinc-200">{plannedText}</span>
            </p>
            <p className="text-[11px] text-zinc-500">
              Cost. sug.: <span className="text-zinc-200">{filaDText}</span>
            </p>
            <p className="text-[11px] text-zinc-500">
              Comprado: <span className="text-zinc-200">{boughtQtyText}</span>
            </p>
            <p className="text-[11px] text-zinc-500">
              Total pagado: <span className="text-zinc-200">{boughtTotalText}</span>
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 w-32">
          <button
            onClick={() => setOpenBuy(true)}
            disabled={!canBuy}
            className="w-full rounded-xl bg-white text-zinc-950 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Comprar
          </button>

          <button
            onClick={reserve}
            disabled={!canReserve || reserving}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs hover:bg-white/10 transition disabled:opacity-50"
          >
            {reserving ? "Reservando..." : "Reservar"}
          </button>
        </div>
      </div>

      {actionsEnabled && !isBought && (
        <div className="mt-2 flex gap-2">
          {[10, 15, 30].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setReserveMinutes(m)}
              className={`rounded-xl px-3 py-1.5 text-[11px] border transition
                ${
                  reserveMinutes === m
                    ? "bg-white text-zinc-950"
                    : "bg-white/5 border-white/10 text-zinc-300"
                }`}
            >
              {m} min
            </button>
          ))}
        </div>
      )}

      {reserveError && (
        <p className="mt-2 text-[11px] text-red-200/80">{reserveError}</p>
      )}

      <ConfirmarCompraModal
        open={openBuy}
        onClose={() => setOpenBuy(false)}
        sessionId={session._id}
        item={item}
        defaultQty={
          Number.isFinite(Number(item?.plannedQty)) && Number(item?.plannedQty) > 0
            ? Number(item?.plannedQty)
            : 1
        }
        onSuccess={() => {
          setLocalState("COMPRADO");
          setLocalReserveExpiresAt(null);
          setLocalReservedBy(null);
          onReload();
        }}
      />
    </div>
  );
}

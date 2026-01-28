import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useSessionRealtime } from "@/hooks/useSessionRealtime";
import { useCountdown } from "@/hooks/useCountdown";

const API_URL = import.meta.env.VITE_API_URL;

function PromoCard({ view }) {
  const endsAt = view?.timing?.endsAt;
  const { label, isExpired } = useCountdown(endsAt);

  if (isExpired) return null;

  const productName = view?.variantId?.productId?.name || "Producto";
  const variantName = view?.variantId?.nameVariant ? ` - ${view.variantId.nameVariant}` : "";
  const title = `${productName}${variantName}`;

  const type = view?.type;
  const promoLabel = type === "PERCENT_OFF" ? `-${view.percentOff}%` : "2x1";

  const promoPrice = view?.pricing?.promoPrice;
  const comboPrice = view?.pricing?.comboPrice;

  let priceLine = "";
  if (type === "PERCENT_OFF") priceLine = promoPrice != null ? `$ ${promoPrice}` : "";
  if (type === "BOGO") priceLine = comboPrice != null ? `2 por $ ${comboPrice}` : "2x1";

  return (
    <div className="rounded-2xl bg-neutral-900/80 border border-neutral-800 p-5 flex gap-5 shadow-lg">
      <div className="w-36 h-36 rounded-xl overflow-hidden bg-neutral-800 shrink-0">
        {view.imageUrl ? (
          <img src={view.imageUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-neutral-400 text-sm">SIN FOTO</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-2xl font-semibold text-white truncate">{title}</div>

        <div className="mt-2 flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-red-600/20 text-red-200 border border-red-700 px-3 py-1 text-lg font-semibold">
            {promoLabel}
          </span>

          <span className="text-neutral-300 text-lg">
            Termina en <span className="font-semibold text-white">{label}</span>
          </span>
        </div>

        <div className="mt-4 text-5xl font-bold text-white">{priceLine}</div>

        {view?.pricing?.salePrice != null ? (
          <div className="mt-2 text-neutral-400 text-lg">
            Normal: <span className="line-through">$ {view.pricing.salePrice}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ScreenPromos() {
  // Por ahora fijo
  const sessionId = import.meta.env.VITE_SESSION_ID;

  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPromos = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/v1/public/sessions/${sessionId}/promotions`);
      setViews(data?.views || []);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  useSessionRealtime({
    sessionId,
    onPromotionsUpdated: () => fetchPromos(),
    // Si cambian costos, el promoPrice cambia: refrescamos promos también
    onDailyPriceUpdated: () => fetchPromos(),
  });

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-white text-3xl font-bold mb-6">Promociones</div>

        {loading ? (
          <div className="text-neutral-400">Cargando...</div>
        ) : views.length === 0 ? (
          <div className="text-neutral-400">No hay promociones activas.</div>
        ) : (
          <div className="space-y-5">
            {views.map((v) => (
              <PromoCard key={v._id} view={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

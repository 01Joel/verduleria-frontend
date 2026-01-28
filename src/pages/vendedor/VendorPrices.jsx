import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api"; // tu instancia con interceptor
import { useSessionRealtime } from "@/hooks/useSessionRealtime";
import { useCountdown } from "@/hooks/useCountdown";

function PromoRow({ view }) {
  const { label, isExpired } = useCountdown(view?.timing?.endsAt);
  if (isExpired) return null;

  const productName = view?.variantId?.productId?.name || "Producto";
  const variantName = view?.variantId?.nameVariant ? ` - ${view.variantId.nameVariant}` : "";
  const title = `${productName}${variantName}`;

  const type = view?.type;
  const promoLabel = type === "PERCENT_OFF" ? `-${view.percentOff}%` : "2x1";
  const promoPrice = view?.pricing?.promoPrice;
  const comboPrice = view?.pricing?.comboPrice;

  const showPrice =
    type === "PERCENT_OFF"
      ? promoPrice != null ? `$ ${promoPrice}` : "-"
      : comboPrice != null ? `2 por $ ${comboPrice}` : "2x1";

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 flex gap-4">
      <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
        {view.imageUrl ? (
          <img src={view.imageUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-neutral-500 text-xs">SIN FOTO</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-white font-semibold truncate">{title}</div>
        <div className="mt-1 text-neutral-400 text-sm">
          Termina en <span className="text-white font-semibold">{label}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-red-600/20 text-red-200 border border-red-700 px-2 py-1 text-sm font-semibold">
            {promoLabel}
          </span>
          <span className="text-white text-xl font-bold">{showPrice}</span>
          {view?.pricing?.salePrice != null ? (
            <span className="text-neutral-400 text-sm line-through">$ {view.pricing.salePrice}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function VendorPrices() {
  // fijo por ahora (o lo tomas de tu store/context de sesión)
  const sessionId = import.meta.env.VITE_SESSION_ID;

  const [dailyPrices, setDailyPrices] = useState([]);
  const [promoViews, setPromoViews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDailyPrices = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await api.get(`/daily-prices?sessionId=${sessionId}`);
    setDailyPrices(data?.prices || []);
  }, [sessionId]);

  const fetchPromos = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await api.get(`/promotions?sessionId=${sessionId}&active=true`);
    setPromoViews(data?.views || []);
  }, [sessionId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchDailyPrices(), fetchPromos()]);
    } finally {
      setLoading(false);
    }
  }, [fetchDailyPrices, fetchPromos]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useSessionRealtime({
    sessionId,
    onDailyPriceUpdated: () => {
      // simple y efectivo
      fetchDailyPrices();
      // promoPrice depende del base => refresco promos también
      fetchPromos();
    },
    onPromotionsUpdated: () => fetchPromos(),
  });

  const normalizedRows = useMemo(() => {
    return dailyPrices.map((p) => {
      const productName = p?.variantId?.productId?.name || "Producto";
      const variantName = p?.variantId?.nameVariant ? ` - ${p.variantId.nameVariant}` : "";
      const title = `${productName}${variantName}`;

      return {
        id: p._id,
        title,
        unitSale: p.unitSale,
        salePrice: p.salePrice,
        status: p.status,
      };
    });
  }, [dailyPrices]);

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-white text-2xl font-bold">Precios del día</div>
        <div className="text-neutral-400 mt-1">Sesión: {sessionId || "-"}</div>

        {loading ? (
          <div className="mt-6 text-neutral-400">Cargando...</div>
        ) : (
          <>
            <div className="mt-8">
              <div className="text-white text-xl font-semibold mb-3">Promociones activas</div>
              {promoViews.length === 0 ? (
                <div className="text-neutral-400">No hay promociones activas.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {promoViews.map((v) => (
                    <PromoRow key={v._id} view={v} />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-10">
              <div className="text-white text-xl font-semibold mb-3">Listado normal</div>
              <div className="overflow-hidden rounded-xl border border-neutral-800">
                <table className="w-full text-left">
                  <thead className="bg-neutral-900">
                    <tr className="text-neutral-300 text-sm">
                      <th className="p-3">Producto</th>
                      <th className="p-3">Unidad</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedRows.map((r) => (
                      <tr key={r.id} className="border-t border-neutral-800 text-neutral-200">
                        <td className="p-3">{r.title}</td>
                        <td className="p-3">{r.unitSale}</td>
                        <td className="p-3">{r.status}</td>
                        <td className="p-3 font-semibold">{r.salePrice != null ? `$ ${r.salePrice}` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import api from "../../../api/api";

// vendedor
export async function listDailyPrices(sessionId) {
  const { data } = await api.get(`/daily-prices?sessionId=${sessionId}`);
  return data;
}

// ✅ margen global
export async function getMargin() {
  const { data } = await api.get("/config/margin");
  return data; // { ok, marginPct }
}

export async function setMargin(marginPct) {
  const { data } = await api.patch("/config/margin", { marginPct });
  return data; // { ok, marginPct }
}

// ✅ recalcular daily prices de una sesión (admin)
export async function recalcSessionDailyPrices(sessionId) {
  const { data } = await api.post(`/daily-prices/recalc?sessionId=${sessionId}`);
  return data; // { ok: true }
}
// admin lista mínima
export async function listAdminPurchasedDailyPrices(sessionId) {
  const { data } = await api.get(`/daily-prices/admin/purchased?sessionId=${sessionId}`);
  return data; // { ok, prices: [] }
}

// admin editar conversion + recalc
export async function updateVariantConversionAndRecalc({ sessionId, variantId, conversion }) {
  const { data } = await api.patch(`/daily-prices/admin/variants/${variantId}/conversion`, {
    sessionId,
    conversion,
  });
  return data; // { ok, price }
}
export async function listDailyPriceBoard(sessionId) {
  const { data } = await api.get(`/daily-prices/board?sessionId=${sessionId}`);
  return data; // { ok, rows: [] }
}

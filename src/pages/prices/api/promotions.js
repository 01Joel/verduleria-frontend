import api from "../../../api/api";

export async function listVendorPromotions(sessionId) {
  const { data } = await api.get(`/promotions/vendor?sessionId=${sessionId}`);
  return data; // { ok, views: [] }
}

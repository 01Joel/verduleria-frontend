import api from "./api";

export async function listPromotions(sessionId) {
  const { data } = await api.get(`/promotions`, { params: { sessionId } });
  return data;
}

export async function upsertPromotion(payload) {
  // POST /promotions (upsert por sessionId+variantId)
  const { data } = await api.post(`/promotions`, payload);
  return data;
}

export async function updatePromotion(id, payload) {
  const { data } = await api.patch(`/promotions/${id}`, payload);
  return data;
}

export async function activatePromotion(id) {
  const { data } = await api.patch(`/promotions/${id}/activate`);
  return data;
}

export async function deactivatePromotion(id) {
  const { data } = await api.patch(`/promotions/${id}/deactivate`);
  return data;
}

export async function setPromotionImage(id, payload) {
  // payload: { imageUrl, publicId }  (o imagePublicId)
  const { data } = await api.patch(`/promotions/${id}/image`, payload);
  return data;
}

export async function removePromotionImage(id) {
  const { data } = await api.delete(`/promotions/${id}/image`);
  return data;
}

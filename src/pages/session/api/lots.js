// src/pages/session/api/lots.js
import api from "../../../api/api";

export async function listLotsBySession(sessionId) {
  const { data } = await api.get(`/purchase-lots`, { params: { sessionId } });
  return data;
}

export async function weighLot(lotId, netWeightKg) {
  const { data } = await api.post(`/purchase-lots/${lotId}/weigh`, { netWeightKg });
  return data;
}

/*import api from "../../../api/api";

export async function listLotsBySession(sessionId) {
  const { data } = await api.get(`/purchase-lots?sessionId=${sessionId}`);
  return data;
}

export async function weighLot(lotId, netWeightKg) {
  const { data } = await api.post(`/purchase-lots/${lotId}/weigh`, { netWeightKg });
  return data;
}
*/
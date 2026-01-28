import api from "./api";

export async function getCurrentSession() {
  // si tu api baseUrl ya incluye /api/v1, esto queda como "/public/..."
  const { data } = await api.get("/public/purchase-sessions/current");
  return data?.session;
}

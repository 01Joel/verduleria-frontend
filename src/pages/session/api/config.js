import api from "../../../api/api";

export async function getMargin() {
  const { data } = await api.get("/config/margin");
  return data; // { ok, marginPct }
}

export async function setMargin(marginPct) {
  const { data } = await api.patch("/config/margin", { marginPct });
  return data; // { ok, marginPct, ... }
}

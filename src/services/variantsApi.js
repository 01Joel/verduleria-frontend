import api from "./api";

export async function listVariants({ active = "true" } = {}) {
  const { data } = await api.get("/variants", { params: { active } });
  return data?.variants || [];
}

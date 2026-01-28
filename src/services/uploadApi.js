import api from "./api";

export async function uploadImage(file) {
  const form = new FormData();
  form.append("file", file);

  const { data } = await api.post("/uploads/image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  // esperado: { ok:true, imageUrl, publicId }
  return data;
}

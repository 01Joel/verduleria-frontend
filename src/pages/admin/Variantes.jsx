import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "../../components/AppLayout";
import Modal from "../../components/Modal";
import api from "../../api/api";

function badgeActive(active) {
  return active
    ? "bg-green-500/10 text-green-300 border-green-500/20"
    : "bg-zinc-500/10 text-zinc-300 border-white/10";
}

function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function withBust(url, seed) {
  if (!url) return "";
  const v = seed ? new Date(seed).getTime() : Date.now();
  return url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`;
}

function toNumberOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

const UNIT_SALE_OPTIONS = ["KG", "ATADO", "UNIDAD", "BANDEJA", "BOLSA"];

// ✅ Unidad de compra sugerida (no obligatoria)
const UNIT_BUY_OPTIONS = [
  "KG",
  "CAJA",
  "FARDO",
  "BOLSA",
  "ATADO",
  "UNIDAD",
];

export default function Variantes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [variants, setVariants] = useState([]);
  const [products, setProducts] = useState([]);

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const [isMobile, setIsMobile] = useState(false);

  // Modal create/edit
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  // Imagen
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);

  const [form, setForm] = useState({
    productId: "",
    nameVariant: "",
    unitSale: "KG",
    unitBuy: "", // opcional
    conversion: "", // opcional (num)
  });

  useEffect(() => {
    setIsMobile(isMobileUA());
  }, []);

  const loadProducts = async () => {
    const { data } = await api.get("/products", { params: { active: "true" } });
    setProducts(data?.ok ? data.products || [] : []);
  };

  const loadVariants = async () => {
    const { data } = await api.get("/variants", {
      params: { active: onlyActive ? "true" : undefined },
    });
    setVariants(data?.ok ? data.variants || [] : []);
  };

  const init = async () => {
    try {
      setLoading(true);
      setError("");
      await Promise.all([loadProducts(), loadVariants()]);
    } catch (e) {
      setError(e?.response?.data?.message || "Error cargando datos");
      setProducts([]);
      setVariants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadVariants().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyActive]);

  const refresh = async () => {
    try {
      setError("");
      await Promise.all([loadProducts(), loadVariants()]);
    } catch (e) {
      setError(e?.response?.data?.message || "Error al actualizar");
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return variants;

    return variants.filter((v) => {
      const prod = v?.productId?.name?.toLowerCase() || "";
      const varName = v?.nameVariant?.toLowerCase() || "";
      const unitSale = v?.unitSale?.toLowerCase() || "";
      const unitBuy = (v?.unitBuy || "").toLowerCase();
      const conv = v?.conversion != null ? String(v.conversion) : "";
      return (
        prod.includes(term) ||
        varName.includes(term) ||
        unitSale.includes(term) ||
        unitBuy.includes(term) ||
        conv.includes(term)
      );
    });
  }, [variants, q]);

  const variantsByProduct = useMemo(() => {
    const map = new Map();
    for (const v of variants) {
      const pid = v?.productId?._id || v?.productId;
      if (!pid) continue;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(v);
    }
    return map;
  }, [variants]);

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setError("");
    setForm({
      productId: "",
      nameVariant: "",
      unitSale: "KG",
      unitBuy: "",
      conversion: "",
    });
    setImageFile(null);
    setRemoveImage(false);
    setOpenModal(true);
  };

  const openEdit = (row) => {
    setMode("edit");
    setEditing(row);
    setError("");

    const pid = row?.productId?._id || row?.productId || "";
    setForm({
      productId: pid,
      nameVariant: row?.nameVariant || "",
      unitSale: row?.unitSale || "KG",
      unitBuy: row?.unitBuy || "",
      conversion: row?.conversion != null ? String(row.conversion) : "",
    });

    setImageFile(null);
    setRemoveImage(false);
    setOpenModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setOpenModal(false);
  };

  const validate = () => {
    const pid = String(form.productId || "").trim();
    const nameVariant = String(form.nameVariant || "").trim();
    const unitSale = String(form.unitSale || "").trim();
    const unitBuy = String(form.unitBuy || "").trim();

    if (!pid) return "Selecciona un producto";
    if (!nameVariant) return "nameVariant es requerido";
    if (!UNIT_SALE_OPTIONS.includes(unitSale))
      return "unitSale inválido (KG/ATADO/UNIDAD)";

    if (unitBuy && !UNIT_BUY_OPTIONS.includes(unitBuy))
      return "unitBuy inválido (KG/CAJA/FARDO/BOLSA/ATADO/UNIDAD)";

    const conv = toNumberOrNull(form.conversion);
    if (form.conversion !== "" && conv == null) return "Conversión inválida";
    if (conv != null && conv <= 0) return "Conversión debe ser > 0";

    // Regla práctica: si pone conversión, debe tener unitBuy (para saber qué convierte)
    if (conv != null && !unitBuy)
      return "Si defines conversión, primero define unidad de compra (unitBuy)";

    return null;
  };

  const uploadImageIfAny = async () => {
    if (!imageFile) return { imageUrl: "", publicId: "" };

    const fd = new FormData();
    fd.append("file", imageFile);

    const up = await api.post("/uploads/image", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (!up.data?.ok) throw new Error(up.data?.message || "Upload falló");

    return { imageUrl: up.data.imageUrl || "", publicId: up.data.publicId || "" };
  };

  const applyImageChange = async (variantId) => {
    if (removeImage) {
      await api.delete(`/variants/${variantId}/image`);
    }

    if (imageFile) {
      const { imageUrl, publicId } = await uploadImageIfAny();
      await api.patch(`/variants/${variantId}/image`, { imageUrl, publicId });
    }
  };

  const submit = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        productId: String(form.productId).trim(),
        nameVariant: String(form.nameVariant).trim(),
        unitSale: String(form.unitSale).trim(),
        unitBuy: String(form.unitBuy || "").trim() || null,
        conversion: toNumberOrNull(form.conversion),
      };

      let variantId = null;

      if (mode === "create") {
        const { data } = await api.post("/variants", payload);
        variantId = data?.variant?._id;
      } else {
        if (!editing?._id) {
          setError("Variante inválida para editar");
          return;
        }
        const { data } = await api.patch(`/variants/${editing._id}`, payload);
        variantId = data?.variant?._id || editing._id;
      }

      if (variantId) {
        await applyImageChange(variantId);
      }

      setOpenModal(false);
      await loadVariants();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Error guardando variante");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      setError("");
      if (row.active) await api.patch(`/variants/${row._id}/baja`);
      else await api.patch(`/variants/${row._id}/alta`);
      await loadVariants();
    } catch (e) {
      setError(e?.response?.data?.message || "Error cambiando estado");
    }
  };

  const createUniqueVariant = async (product) => {
    try {
      setError("");
      const pid = product?._id;
      if (!pid) return;

      const name = (product?.name || "").toLowerCase();
      let unitSale = "KG";
      if (
        name.includes("perejil") ||
        name.includes("cilantro") ||
        name.includes("acelga") ||
        name.includes("espinaca")
      ) {
        unitSale = "ATADO";
      }

      await api.post("/variants", {
        productId: pid,
        nameVariant: "Única",
        unitSale,
        unitBuy: null,
        conversion: null,
      });

      await loadVariants();
    } catch (e) {
      setError(e?.response?.data?.message || "Error creando variante Única");
    }
  };

  const productsWithoutVariants = useMemo(() => {
    return (products || []).filter((p) => {
      const list = variantsByProduct.get(p._id) || [];
      const activeCount = list.filter((v) => v.active).length;
      return activeCount === 0;
    });
  }, [products, variantsByProduct]);

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-zinc-400">Cargando variantes…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-4"
      >
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Variantes</p>
              {/*<p className="text-xs text-zinc-500 mt-1">
                Todo lo operativo (compras, precios del día, promos) se maneja por variante.
                Para productos “sin variantes”, crea una variante{" "}
                <span className="text-zinc-200">Única</span>.
              </p>*/}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
              >
                Actualizar
              </button>

              <button
                onClick={openCreate}
                className="rounded-xl bg-white text-zinc-950 px-3 py-2 text-xs font-medium hover:opacity-95 transition"
              >
                Nueva variante
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
              placeholder="Buscar por producto, variante, unidad (venta/compra) o conversión…"
            />

            <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="accent-white"
              />
              <span className="text-zinc-200">Solo activas</span>
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Productos sin variante activa */}
        {productsWithoutVariants.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold">Productos sin variante activa</p>
            <p className="text-xs text-zinc-500 mt-1">
              Para operar compras y precios, cada producto debe tener al menos 1 variante activa.
            </p>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {productsWithoutVariants.slice(0, 8).map((p) => (
                <div
                  key={p._id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-zinc-500 mt-1 truncate">{p.category || "—"}</p>
                  </div>
                  <button
                    onClick={() => createUniqueVariant(p)}
                    className="shrink-0 rounded-xl bg-white text-zinc-950 px-3 py-2 text-xs font-medium"
                  >
                    Crear “Única”
                  </button>
                </div>
              ))}
            </div>

            {productsWithoutVariants.length > 8 && (
              <p className="text-[11px] text-zinc-500 mt-2">
                Mostrando 8 de {productsWithoutVariants.length}. Usa búsqueda o crea variantes manualmente.
              </p>
            )}
          </div>
        )}

        {/* Listado */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm">No hay variantes para mostrar.</p>
            <p className="text-xs text-zinc-500 mt-2">
              Crea una variante o desactiva el filtro “Solo activas”.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:hidden">
              {filtered.map((v) => (
                <div key={v._id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-200 truncate">
                        {v?.productId?.name || "Producto"}{" "}
                        <span className="text-zinc-400">· {v?.nameVariant || "—"}</span>
                      </p>

                      <p className="text-xs text-zinc-500 mt-1">
                        Venta: <span className="text-zinc-200">{v?.unitSale || "—"}</span>{" "}
                        · Compra: <span className="text-zinc-200">{v?.unitBuy || "—"}</span>
                      </p>

                      <p className="text-xs text-zinc-500 mt-1">
                        Conversión:{" "}
                        <span className="text-zinc-200">
                          {v?.conversion != null ? v.conversion : "PENDIENTE"}
                        </span>
                      </p>
                    </div>

                    <span className={`shrink-0 text-[11px] rounded-lg border px-2 py-1 ${badgeActive(v.active)}`}>
                      {v.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  {v.imageUrl ? (
                    <img
                      src={withBust(v.imageUrl, v.updatedAt)}
                      alt="variant"
                      className="mt-3 h-28 w-full rounded-xl object-cover border border-white/10"
                      loading="lazy"
                    />
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEdit(v)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActive(v)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                    >
                      {v.active ? "Baja" : "Alta"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-xs text-zinc-500">
                <div className="col-span-2">Producto</div>
                <div className="col-span-2">Variante</div>
                <div className="col-span-2">Venta</div>
                <div className="col-span-2">Compra</div>
                <div className="col-span-1">Conv</div>
                <div className="col-span-1">Estado</div>
                <div className="col-span-0" />
              </div>

              <div className="divide-y divide-white/10">
                {filtered.map((v) => (
                  <div key={v._id} className="px-4 py-3">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-2">
                        <p className="text-sm font-semibold text-zinc-200">
                          {v?.productId?.name || "—"}
                        </p>

                        {v.imageUrl ? (
                          <img
                            src={withBust(v.imageUrl, v.updatedAt)}
                            alt="variant"
                            className="mt-2 h-14 w-24 rounded-xl object-cover border border-white/10"
                            loading="lazy"
                          />
                        ) : null}
                      </div>

                      <div className="col-span-2">
                        <p className="text-sm text-zinc-200">{v?.nameVariant || "—"}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-sm text-zinc-200">{v?.unitSale || "—"}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-sm text-zinc-200">{v?.unitBuy || "—"}</p>
                      </div>

                      <div className="col-span-1">
                        <p className="text-sm text-zinc-200">
                          {v?.conversion != null ? v.conversion : "—"}
                        </p>
                        {v?.conversion == null && v?.unitBuy && v?.unitBuy !== v?.unitSale ? (
                          <p className="text-[10px] text-yellow-200/90">PEND.</p>
                        ) : (
                          <p className="text-[10px] text-zinc-500">&nbsp;</p>
                        )}
                      </div>

                      <div className="col-span-1">
                        <span className={`text-[11px] rounded-lg border px-2 py-1 ${badgeActive(v.active)}`}>
                          {v.active ? "Activa" : "Inactiva"}
                        </span>
                      </div>

                      <div className="col-span-2 flex justify-end gap-2 mt-2 md:mt-0">
                        <button
                          onClick={() => openEdit(v)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => toggleActive(v)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                        >
                          {v.active ? "Baja" : "Alta"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Modal create/edit */}
        <Modal
          open={openModal}
          onClose={closeModal}
          title={mode === "create" ? "Nueva variante" : "Editar variante"}
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Producto</p>
              <select
                value={form.productId}
                onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
              >
                <option value="">Selecciona…</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} {p.category ? `· ${p.category}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Nombre de variante</p>
              <input
                value={form.nameVariant}
                onChange={(e) => setForm((f) => ({ ...f, nameVariant: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                placeholder='Ej: Nacional / Importado / "Única"'
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Dentro del mismo producto es unique (productId + nameVariant).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-zinc-500">Unidad de venta</p>
                <select
                  value={form.unitSale}
                  onChange={(e) => setForm((f) => ({ ...f, unitSale: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                >
                  {UNIT_SALE_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Cómo lo vendes al público (impacta en precio del día).
                </p>
              </div>

              <div>
                <p className="text-xs text-zinc-500">Unidad de compra sugerida (opcional)</p>
                <select
                  value={form.unitBuy}
                  onChange={(e) => setForm((f) => ({ ...f, unitBuy: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                >
                  <option value="">— (sin definir)</option>
                  {UNIT_BUY_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Se usa como sugerencia al planificar y al confirmar compra.
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Conversión (opcional)</p>
              <input
                value={form.conversion}
                onChange={(e) => setForm((f) => ({ ...f, conversion: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                placeholder="Ej: 12.5"
                inputMode="decimal"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Se usa cuando compra ≠ venta. Ejemplos:
                <span className="text-zinc-300"> CAJA→KG </span> (kg por caja),
                <span className="text-zinc-300"> FARDO→ATADO </span> (atados por fardo).
                Si no se define, queda <span className="text-yellow-200">PENDIENTE</span>.
              </p>
            </div>

            {/* Imagen */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-semibold">Imagen (opcional)</p>
              <p className="text-xs text-zinc-500 mt-1">
                Sube una foto para diferenciar visualmente la variante.
              </p>

              {mode === "edit" && editing?.imageUrl ? (
                <div className="mt-3">
                  <img
                    src={withBust(editing.imageUrl, editing.updatedAt)}
                    alt="current"
                    className="h-32 w-full rounded-xl object-cover border border-white/10"
                    loading="lazy"
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-zinc-200 select-none">
                    <input
                      type="checkbox"
                      checked={removeImage}
                      onChange={(e) => setRemoveImage(e.target.checked)}
                      className="accent-white"
                    />
                    Quitar imagen actual
                  </label>
                </div>
              ) : null}

              <div className="mt-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="text-sm text-zinc-200"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Se sube a Cloudinary vía <span className="text-zinc-200">/uploads/image</span>.
                </p>
              </div>
            </div>

            <button
              disabled={saving}
              onClick={submit}
              className="w-full rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium text-center disabled:opacity-60"
            >
              {saving ? "Guardando…" : mode === "create" ? "Crear variante" : "Guardar cambios"}
            </button>

            {mode === "edit" && editing?._id && (
              <p className="text-[11px] text-zinc-500">
                ID: <span className="text-zinc-400">{editing._id}</span>
              </p>
            )}
          </div>
        </Modal>
      </motion.div>
    </AppLayout>
  );
}

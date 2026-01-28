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

const CATEGORY_OPTIONS = [
  "Verduras",
  "Tubérculos",
  "Hierbas",
  "Cítricos",
  "Secos",
];

function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

export default function Productos() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // búsqueda + filtro instantáneo
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  // modal create/edit
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  // Detectar móvil (para no depender de <datalist>)
  const [isMobile, setIsMobile] = useState(false);

  const [form, setForm] = useState({
    name: "",
    category: "",
  });

  // UI móvil de categoría
  const [categoryMode, setCategoryMode] = useState("select"); // select | custom
  const [categorySelect, setCategorySelect] = useState(""); // valor del select
  const [categoryCustom, setCategoryCustom] = useState(""); // valor del input "otro"

  useEffect(() => {
    setIsMobile(isMobileUA());
  }, []);

  const load = async () => {
    try {
      setError("");
      setLoading(true);

      const { data } = await api.get("/products", {
        params: { active: onlyActive ? "true" : undefined },
      });

      setRows(data?.ok ? data.products || [] : []);
    } catch (e) {
      setRows([]);
      setError(e?.response?.data?.message || "Error cargando productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyActive]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((p) => {
      const a = (p?.name || "").toLowerCase();
      const b = (p?.category || "").toLowerCase();
      return a.includes(term) || b.includes(term);
    });
  }, [rows, q]);

  // Sugerencias dinámicas: mezcla opciones fijas + categorías existentes en DB
  const categorySuggestions = useMemo(() => {
    const fromDb = Array.from(
      new Set(
        (rows || [])
          .map((p) => String(p?.category || "").trim())
          .filter(Boolean)
      )
    );

    const merged = Array.from(new Set([...CATEGORY_OPTIONS, ...fromDb]));
    return merged.sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const resetCategoryUIFromValue = (value) => {
    const v = String(value || "").trim();
    if (!v) {
      setCategoryMode("select");
      setCategorySelect("");
      setCategoryCustom("");
      return;
    }

    // Si coincide con sugerencias => select, sino custom
    const match = categorySuggestions.includes(v);
    if (match) {
      setCategoryMode("select");
      setCategorySelect(v);
      setCategoryCustom("");
    } else {
      setCategoryMode("custom");
      setCategorySelect("__OTHER__");
      setCategoryCustom(v);
    }
  };

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setForm({ name: "", category: "" });
    setError("");
    resetCategoryUIFromValue("");
    setOpenModal(true);
  };

  const openEdit = (row) => {
    setMode("edit");
    setEditing(row);
    const next = {
      name: row?.name || "",
      category: row?.category || "",
    };
    setForm(next);
    setError("");
    resetCategoryUIFromValue(next.category);
    setOpenModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setOpenModal(false);
  };

  const validate = () => {
    const name = String(form.name || "").trim();
    if (!name) return "name es requerido";
    if (name.length < 2) return "name muy corto";
    return null;
  };

  const getFinalCategory = () => {
    if (!isMobile) return String(form.category || "").trim();

    if (categoryMode === "custom") return String(categoryCustom || "").trim();
    // select
    if (categorySelect === "__OTHER__") return String(categoryCustom || "").trim();
    return String(categorySelect || "").trim();
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
        name: String(form.name || "").trim(),
        category: getFinalCategory(),
      };

      if (mode === "create") {
        await api.post("/products", payload);
      } else {
        if (!editing?._id) {
          setError("Producto inválido para editar");
          return;
        }
        await api.patch(`/products/${editing._id}`, payload);
      }

      setOpenModal(false);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error guardando producto");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      setError("");
      if (row.active) await api.patch(`/products/${row._id}/baja`);
      else await api.patch(`/products/${row._id}/alta`);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error cambiando estado");
    }
  };

  // Si cambian sugerencias (por load), re-sincronizamos el UI de categoría si el modal está abierto
  useEffect(() => {
    if (!openModal) return;
    resetCategoryUIFromValue(form.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySuggestions.length]);

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
              <p className="text-sm font-semibold">Productos</p>
              <p className="text-xs text-zinc-500 mt-1">
                Catálogo base. Las variantes se crean por producto.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
              >
                Actualizar
              </button>

              <button
                onClick={openCreate}
                className="rounded-xl bg-white text-zinc-950 px-3 py-2 text-xs font-medium hover:opacity-95 transition"
              >
                Nuevo producto
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
              placeholder="Buscar por nombre o categoría…"
            />

            <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="accent-white"
              />
              <span className="text-zinc-200">Solo activos</span>
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* LISTADO */}
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-zinc-400">Cargando productos…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm">No hay productos para mostrar.</p>
            <p className="text-xs text-zinc-500 mt-2">
              Crea uno con “Nuevo producto” o desactiva el filtro “Solo activos”.
            </p>
          </div>
        ) : (
          <>
            {/* ✅ MOBILE: cards compactas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:hidden">
              {filtered.map((p) => (
                <div
                  key={p._id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-200 truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {p.category || "—"}
                      </p>
                    </div>

                    <span className={`shrink-0 text-[11px] rounded-lg border px-2 py-1 ${badgeActive(p.active)}`}>
                      {p.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => toggleActive(p)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                    >
                      {p.active ? "Baja" : "Alta"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ✅ DESKTOP: tabla */}
            <div className="hidden md:block rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-xs text-zinc-500">
                <div className="col-span-4">Producto</div>
                <div className="col-span-4">Categoría</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-2 text-right">Acciones</div>
              </div>

              <div className="divide-y divide-white/10">
                {filtered.map((p) => (
                  <div key={p._id} className="px-4 py-3">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <p className="text-sm font-semibold text-zinc-200">
                          {p.name}
                        </p>
                      </div>

                      <div className="col-span-4">
                        <p className="text-sm text-zinc-200">{p.category || "—"}</p>
                      </div>

                      <div className="col-span-2">
                        <span className={`text-[11px] rounded-lg border px-2 py-1 ${badgeActive(p.active)}`}>
                          {p.active ? "Activo" : "Inactivo"}
                        </span>
                      </div>

                      <div className="col-span-2 flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => toggleActive(p)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                        >
                          {p.active ? "Baja" : "Alta"}
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
          title={mode === "create" ? "Nuevo producto" : "Editar producto"}
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Nombre (único)</p>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                placeholder="Ej: Durazno"
              />
            </div>

            {/* Categoría */}
            <div>
              <p className="text-xs text-zinc-500">Categoría (opcional)</p>

              {/* ✅ MOBILE: select + otro */}
              {isMobile ? (
                <div className="mt-1 space-y-2">
                  <select
                    value={categorySelect}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCategorySelect(v);
                      if (v === "__OTHER__") {
                        setCategoryMode("custom");
                        setCategoryCustom((prev) => prev || "");
                        setForm((f) => ({ ...f, category: categoryCustom || "" }));
                      } else {
                        setCategoryMode("select");
                        setCategoryCustom("");
                        setForm((f) => ({ ...f, category: v }));
                      }
                    }}
                    className="w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                  >
                    <option value="">(Sin categoría)</option>
                    {categorySuggestions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__OTHER__">Otro…</option>
                  </select>

                  {categoryMode === "custom" && (
                    <input
                      value={categoryCustom}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCategoryCustom(v);
                        setForm((f) => ({ ...f, category: v }));
                      }}
                      className="w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                      placeholder="Escribe la categoría…"
                    />
                  )}

                  <p className="text-[11px] text-zinc-500">
                    En celular usamos select porque <span className="text-zinc-400">&lt;datalist&gt;</span> no es confiable.
                  </p>
                </div>
              ) : (
                /* ✅ DESKTOP: datalist */
                <div className="mt-1">
                  <input
                    list="categories"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                    placeholder="Ej: Frutas"
                  />
                  <datalist id="categories">
                    {categorySuggestions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>

                  <p className="text-[11px] text-zinc-500 mt-1">
                    Sugerencias disponibles, pero puedes escribir una categoría nueva.
                  </p>
                </div>
              )}
            </div>

            <button
              disabled={saving}
              onClick={submit}
              className="w-full rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium text-center disabled:opacity-60"
            >
              {saving ? "Guardando…" : mode === "create" ? "Crear producto" : "Guardar cambios"}
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

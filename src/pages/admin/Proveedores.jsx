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

export default function Proveedores() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // búsqueda + filtro (instantáneo)
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  // modal create/edit
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    nickname: "",
    name: "",
    lastname: "",
  });

  const load = async () => {
    try {
      setError("");
      setLoading(true);

      const { data } = await api.get("/suppliers", {
        params: { active: onlyActive ? "true" : undefined },
      });

      setRows(data?.ok ? data.suppliers || [] : []);
    } catch (e) {
      setRows([]);
      setError(e?.response?.data?.message || "Error cargando proveedores");
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

    return rows.filter((s) => {
      const a = (s?.nickname || "").toLowerCase();
      const b = (s?.name || "").toLowerCase();
      const c = (s?.lastname || "").toLowerCase();
      return a.includes(term) || b.includes(term) || c.includes(term);
    });
  }, [rows, q]);

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setForm({ nickname: "", name: "", lastname: "" });
    setError("");
    setOpenModal(true);
  };

  const openEdit = (row) => {
    setMode("edit");
    setEditing(row);
    setForm({
      nickname: row?.nickname || "",
      name: row?.name || "",
      lastname: row?.lastname || "",
    });
    setError("");
    setOpenModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setOpenModal(false);
  };

  const validate = () => {
    const nick = String(form.nickname || "").trim().toLowerCase();
    if (!nick) return "nickname es requerido";
    if (nick.length < 2) return "nickname muy corto";
    return null;
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
        nickname: String(form.nickname || "").trim().toLowerCase(),
        name: String(form.name || "").trim(),
        lastname: String(form.lastname || "").trim(),
      };

      if (mode === "create") {
        await api.post("/suppliers", payload);
      } else {
        if (!editing?._id) {
          setError("Proveedor inválido para editar");
          return;
        }
        await api.patch(`/suppliers/${editing._id}`, payload);
      }

      setOpenModal(false);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error guardando proveedor");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      setError("");
      if (row.active) await api.patch(`/suppliers/${row._id}/baja`);
      else await api.patch(`/suppliers/${row._id}/alta`);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error cambiando estado");
    }
  };

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
              <p className="text-sm font-semibold">Proveedores</p>
              <p className="text-xs text-zinc-500 mt-1">
                panel de control de proveedores.
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
                Nuevo proveedor
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
              placeholder="Buscar por nickname, nombre o apellido…"
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

        {/* Table/Card list */}
        {/* Lista responsive: cards compactas en móvil + tabla en desktop */}
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-zinc-400">Cargando proveedores…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm">No hay proveedores para mostrar.</p>
            <p className="text-xs text-zinc-500 mt-2">
              Crea uno con “Nuevo proveedor” o desactiva el filtro “Solo activos”.
            </p>
          </div>
        ) : (
          <>
            {/* ✅ MOBILE: cards compactas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:hidden">
              {filtered.map((s) => {
                const fullName = [s?.name, s?.lastname].filter(Boolean).join(" ").trim();
            
                return (
                  <div
                    key={s._id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-200 truncate">
                          {s.nickname}
                        </p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {fullName || "—"}
                        </p>
                      </div>
                
                      <span className={`shrink-0 text-[11px] rounded-lg border px-2 py-1 ${badgeActive(s.active)}`}>
                        {s.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                      >
                        Editar
                      </button>
                
                      <button
                        onClick={() => toggleActive(s)}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                      >
                        {s.active ? "Baja" : "Alta"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          
            {/* ✅ DESKTOP: tabla como ya tenías */}
            <div className="hidden md:block rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-xs text-zinc-500">
                <div className="col-span-3">Nickname</div>
                <div className="col-span-3">Nombre</div>
                <div className="col-span-3">Apellido</div>
                <div className="col-span-1">Estado</div>
                <div className="col-span-2 text-right">Acciones</div>
              </div>
          
              <div className="divide-y divide-white/10">
                {filtered.map((s) => (
                  <div key={s._id} className="px-4 py-3">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <p className="text-sm font-semibold text-zinc-200">{s.nickname}</p>
                      </div>
                
                      <div className="col-span-3">
                        <p className="text-sm text-zinc-200">{s.name || "—"}</p>
                      </div>
                
                      <div className="col-span-3">
                        <p className="text-sm text-zinc-200">{s.lastname || "—"}</p>
                      </div>
                
                      <div className="col-span-1">
                        <span className={`text-[11px] rounded-lg border px-2 py-1 ${badgeActive(s.active)}`}>
                          {s.active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                
                      <div className="col-span-2 flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                        >
                          Editar
                        </button>
                
                        <button
                          onClick={() => toggleActive(s)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                        >
                          {s.active ? "Baja" : "Alta"}
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
          title={mode === "create" ? "Nuevo proveedor" : "Editar proveedor"}
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Nickname (único)</p>
              <input
                value={form.nickname}
                onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                placeholder="ej: don_pepe"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Se guarda en minúsculas automáticamente.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-zinc-500">Nombre</p>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                  placeholder="ej: Juan"
                />
              </div>

              <div>
                <p className="text-xs text-zinc-500">Apellido</p>
                <input
                  value={form.lastname}
                  onChange={(e) => setForm((f) => ({ ...f, lastname: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                  placeholder="ej: Pérez"
                />
              </div>
            </div>

            <button
              disabled={saving}
              onClick={submit}
              className="w-full rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium text-center disabled:opacity-60"
            >
              {saving ? "Guardando…" : mode === "create" ? "Crear proveedor" : "Guardar cambios"}
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

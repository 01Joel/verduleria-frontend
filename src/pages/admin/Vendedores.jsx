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

export default function Vendedores() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Modal crear
  const [openCreate, setOpenCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Modal reset password
  const [openReset, setOpenReset] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState("");

  const load = async ({ term, onlyActives } = {}) => {
    const params = { role: "VENDEDOR" };
    if (onlyActives) params.active = "true";
    if (term && term.trim()) params.q = term.trim();

    const { data } = await api.get("/users", { params });
    setUsers(data?.users || []);
  };

  const init = async () => {
    try {
      setLoading(true);
      setError("");
      await load({ term: q, onlyActives: onlyActive });
    } catch (e) {
      setError(e?.response?.data?.message || "Error cargando vendedores");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Auto-busqueda + auto-filtro (debounce)
  useEffect(() => {
    const t = setTimeout(() => {
      load({ term: q, onlyActives: onlyActive }).catch((e) => {
        setError(e?.response?.data?.message || "Error cargando vendedores");
        setUsers([]);
      });
    }, 300);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, onlyActive]);

  const filtered = useMemo(() => users, [users]);

  const refresh = async () => {
    try {
      setError("");
      await load({ term: q, onlyActives: onlyActive });
    } catch (e) {
      setError(e?.response?.data?.message || "Error actualizando");
    }
  };

  const createVendor = async () => {
    try {
      setSaving(true);
      setError("");

      await api.post("/users/vendors", {
        username: newUsername,
        password: newPassword,
      });

      setOpenCreate(false);
      setNewUsername("");
      setNewPassword("");
      await load({ term: q, onlyActives: onlyActive });
    } catch (e) {
      setError(e?.response?.data?.message || "Error creando vendedor");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      setError("");
      setSaving(true);

      if (u.active) await api.patch(`/users/${u._id}/baja`);
      else await api.patch(`/users/${u._id}/alta`);

      await load({ term: q, onlyActives: onlyActive });
    } catch (e) {
      setError(e?.response?.data?.message || "Error cambiando estado");
    } finally {
      setSaving(false);
    }
  };

  const changeUsername = async (u, username) => {
    try {
      setError("");
      setSaving(true);

      await api.patch(`/users/${u._id}`, { username });

      await load({ term: q, onlyActives: onlyActive });
    } catch (e) {
      setError(e?.response?.data?.message || "Error actualizando username");
    } finally {
      setSaving(false);
    }
  };

  const doResetPassword = async () => {
    try {
      if (!resetUser?._id) return;

      setSaving(true);
      setError("");

      await api.patch(`/users/${resetUser._id}/password`, { password: resetPassword });

      setOpenReset(false);
      setResetUser(null);
      setResetPassword("");
    } catch (e) {
      setError(e?.response?.data?.message || "Error reseteando password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-zinc-400">Cargando vendedores…</p>
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
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Vendedores</p>
              <p className="text-xs text-zinc-500 mt-1">
                Gestión de usuarios con rol <span className="text-zinc-200">VENDEDOR</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
              >
                Actualizar
              </button>

              <button
                onClick={() => {
                  setError("");
                  setOpenCreate(true);
                }}
                className="rounded-xl bg-white text-zinc-950 px-3 py-2 text-xs font-medium"
              >
                Nuevo vendedor
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setError("");
              }}
              className="flex-1 rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
              placeholder="Buscar por username..."
            />

            <label className="flex items-center gap-2 text-xs text-zinc-300 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => {
                  setOnlyActive(e.target.checked);
                  setError("");
                }}
              />
              Solo activos
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm">No hay vendedores para mostrar.</p>
            <p className="text-xs text-zinc-500 mt-2">
              Prueba desactivar “Solo activos” o crea uno nuevo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((u) => (
              <VendorCard
                key={u._id}
                u={u}
                onToggle={() => toggleActive(u)}
                onReset={() => {
                  setResetUser(u);
                  setResetPassword("");
                  setError("");
                  setOpenReset(true);
                }}
                onChangeUsername={(next) => changeUsername(u, next)}
                saving={saving}
              />
            ))}
          </div>
        )}

        {/* Modal crear */}
        <Modal
          open={openCreate}
          onClose={() => setOpenCreate(false)}
          title="Nuevo vendedor"
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Username</p>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                placeholder="ej: caja1"
              />
            </div>      

            <div>
              <p className="text-xs text-zinc-500">Password</p>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                placeholder="mínimo 4"
              />
            </div>      

            <button
              disabled={saving}
              onClick={createVendor}
              className="w-full rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium text-center disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Crear vendedor"}
            </button>
          </div>
        </Modal>


        {/* Modal reset password */}
        <Modal
          open={openReset}
          onClose={() => setOpenReset(false)}
          title="Reset de password"
        >
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Usuario: <span className="text-zinc-200">{resetUser?.username}</span>
            </p>

            <div>
              <p className="text-xs text-zinc-500">Nuevo password</p>
              <input
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                type="password"
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                placeholder="mínimo 4"
              />
            </div>

            <button
              disabled={saving}
              onClick={doResetPassword}
              className="w-full rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium text-center disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Actualizar password"}
            </button>
          </div>
        </Modal>
      </motion.div>
    </AppLayout>
  );
}

function VendorCard({ u, onToggle, onReset, onChangeUsername, saving }) {
  const [edit, setEdit] = useState(false);
  const [username, setUsername] = useState(u.username);

  useEffect(() => setUsername(u.username), [u.username]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{u.username}</p>
          <p className="text-xs text-zinc-500 mt-1">
            Rol: <span className="text-zinc-200">{u.role}</span>
          </p>
        </div>

        <span className={`text-[11px] rounded-lg border px-2 py-1 ${badgeActive(u.active)}`}>
          {u.active ? "ACTIVO" : "INACTIVO"}
        </span>
      </div>

      <div className="mt-3">
        {edit ? (
          <div className="flex gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex-1 rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20 transition text-sm"
            />
            <button
              disabled={saving}
              onClick={() => {
                setEdit(false);
                onChangeUsername(username);
              }}
              className="rounded-xl bg-white text-zinc-950 px-3 py-2 text-xs font-medium disabled:opacity-60"
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setEdit(false);
                setUsername(u.username);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEdit(true)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
            >
              Editar username
            </button>
            <button
              onClick={onReset}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
            >
              Reset password
            </button>
            <button
              disabled={saving}
              onClick={onToggle}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition disabled:opacity-60"
            >
              {u.active ? "Dar de baja" : "Dar de alta"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

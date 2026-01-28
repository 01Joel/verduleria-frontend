import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "../../components/AppLayout";
import Modal from "../../components/Modal";
import api from "../../api/api";

function pickTodaySession(sessions = []) {
  // Preferimos ABIERTA; si no, PLANIFICACION; si no, la más reciente
  const open = sessions
    .filter((s) => s.status === "ABIERTA")
    .sort((a, b) => new Date(b.dateTarget || b.createdAt) - new Date(a.dateTarget || a.createdAt))[0];
  if (open) return open;

  const plan = sessions
    .filter((s) => s.status === "PLANIFICACION")
    .sort((a, b) => new Date(b.dateTarget || b.createdAt) - new Date(a.dateTarget || a.createdAt))[0];
  if (plan) return plan;

  return (
    sessions
      .slice()
      .sort((a, b) => new Date(b.dateTarget || b.createdAt) - new Date(a.dateTarget || a.createdAt))[0] || null
  );
}

function formatMs(ms) {
  const x = Math.max(0, ms);
  const total = Math.floor(x / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function badgeByStatus(status) {
  if (status === "ABIERTA") return "bg-green-500/10 text-green-300 border-green-500/20";
  if (status === "PLANIFICACION") return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
  if (status === "CERRADA") return "bg-zinc-500/10 text-zinc-300 border-white/10";
  return "bg-white/5 text-zinc-300 border-white/10";
}

export default function Promociones() {
  const [loading, setLoading] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null);

  const [variants, setVariants] = useState([]);
  const [views, setViews] = useState([]);

  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const [nowTick, setNowTick] = useState(Date.now());

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: "PERCENT_OFF",
    percentOff: 30,
    buyQty: 2,
    payQty: 1,
    durationHours: 24,
    imageFile: null,
  });

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadSessions = async () => {
    const { data } = await api.get("/purchase-sessions/");
    const list = data?.ok ? data.sessions || [] : [];
    setSessions(list);
    const today = pickTodaySession(list);
    setSession(today);
    return today;
  };

  const loadVariants = async () => {
    const { data } = await api.get("/variants", { params: { active: "true" } });
    setVariants(data?.variants || []);
  };

  const loadPromos = async (sessionId) => {
    const { data } = await api.get("/promotions", { params: { sessionId } });
    setViews(data?.views || []);
  };

  const init = async () => {
    try {
      setLoading(true);
      setError("");

      const today = await loadSessions();
      await loadVariants();

      if (today?._id) {
        await loadPromos(today._id);
      } else {
        setViews([]);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Error cargando promociones");
      setSessions([]);
      setSession(null);
      setVariants([]);
      setViews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    try {
      setError("");
      const today = await loadSessions();
      await loadVariants();
      if (today?._id) await loadPromos(today._id);
    } catch (e) {
      setError(e?.response?.data?.message || "Error al actualizar");
    }
  };

  const filteredVariants = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return variants.slice(0, 24);

    return variants
      .filter((v) => {
        const prod = v?.productId?.name?.toLowerCase() || "";
        const varName = v?.nameVariant?.toLowerCase() || "";
        return prod.includes(term) || varName.includes(term);
      })
      .slice(0, 24);
  }, [variants, q]);

  const filteredViews = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return views;

    return views.filter((p) => {
      const prod = p?.variantId?.productId?.name?.toLowerCase() || "";
      const varName = p?.variantId?.nameVariant?.toLowerCase() || "";
      return prod.includes(term) || varName.includes(term);
    });
  }, [views, q]);

  const openCreateModal = (variant) => {
    setSelectedVariant(variant);
    setForm({
      type: "PERCENT_OFF",
      percentOff: 30,
      buyQty: 2,
      payQty: 1,
      durationHours: 24,
      imageFile: null,
    });
    setError("");
    setModalOpen(true);
  };

  const handleCreatePromo = async () => {
    if (!session?._id) {
      setError("No hay sesión disponible (ABIERTA o PLANIFICACION).");
      return;
    }
    if (!selectedVariant?._id) {
      setError("Selecciona una variante.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      // 1) Upload imagen si existe
      let imageUrl = "";
      let imagePublicId = "";

      if (form.imageFile) {
        const fd = new FormData();
        fd.append("file", form.imageFile);

        const up = await api.post("/uploads/image", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (!up.data?.ok) throw new Error(up.data?.message || "Upload falló");
        imageUrl = up.data.imageUrl || "";
        imagePublicId = up.data.publicId || "";
      }

      // 2) endsAt basado en duración
      const hours = Number(form.durationHours);
      if (!(hours > 0)) {
        setError("Duración inválida.");
        return;
      }
      const endsAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

      // 3) Payload
      const payload = {
        sessionId: session._id,
        variantId: selectedVariant._id,
        type: form.type,
        endsAt,
        active: true,
        imageUrl,
        imagePublicId,
      };

      if (form.type === "PERCENT_OFF") {
        const pct = Number(form.percentOff);
        if (!(pct > 0 && pct < 95)) {
          setError("percentOff debe ser un número (1 a 94).");
          return;
        }
        payload.percentOff = pct;
      } else if (form.type === "BOGO") {
        const buy = Number(form.buyQty);
        const pay = Number(form.payQty);
        if (!(buy > 1) || !(pay >= 1) || pay >= buy) {
          setError("BOGO inválido. Ej: buyQty=2 payQty=1");
          return;
        }
        payload.buyQty = buy;
        payload.payQty = pay;
      }

      // 4) Upsert
      await api.post("/promotions", payload);

      setModalOpen(false);
      setSelectedVariant(null);

      await loadPromos(session._id);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Error creando promoción");
    } finally {
      setSaving(false);
    }
  };

  const togglePromo = async (promo) => {
    try {
      setError("");
      if (promo.active) await api.patch(`/promotions/${promo._id}/deactivate`);
      else await api.patch(`/promotions/${promo._id}/activate`);
      await loadPromos(session._id);
    } catch (e) {
      setError(e?.response?.data?.message || "Error cambiando estado de la promo");
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-zinc-400">Cargando promociones…</p>
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm">No hay sesiones creadas todavía.</p>
          <p className="text-xs text-zinc-500 mt-2">Crea una sesión y vuelve a intentar.</p>
        </div>
      </AppLayout>
    );
  }

  const modalTitle = selectedVariant
    ? `Nueva promoción · ${selectedVariant?.productId?.name} · ${selectedVariant?.nameVariant}`
    : "Nueva promoción";

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-4"
      >
        {/* Header card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Promociones</p>
              <p className="text-xs text-zinc-500 mt-1">
                Sesión: <span className="text-zinc-200">{session.dateKey}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[11px] rounded-lg border px-2 py-1 ${badgeByStatus(session.status)}`}>
                {session.status}
              </span>

              <button
                onClick={refresh}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
              >
                Actualizar
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
              placeholder="Buscar producto o variante..."
            />
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div>
          )}
        </div>

        {/* Promos actuales */}
        {filteredViews.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm">No hay promociones en esta sesión.</p>
            <p className="text-xs text-zinc-500 mt-2">Crea una promo buscando una variante abajo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredViews.map((p) => {
              const remaining = new Date(p?.timing?.endsAt).getTime() - nowTick;

              const prod = p?.variantId?.productId?.name || "—";
              const varName = p?.variantId?.nameVariant || "—";

              const promoLabel =
                p.type === "PERCENT_OFF" ? `-${p.percentOff}%` : p.type === "BOGO" ? "2x1" : p.type;

              const normalPrice = p?.pricing?.salePrice ?? null;
              const promoPrice = p.type === "PERCENT_OFF" ? p?.pricing?.promoPrice ?? null : p?.pricing?.comboPrice ?? null;

              return (
                <div key={p._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {prod} <span className="text-zinc-400">· {varName}</span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Unidad: <span className="text-zinc-200">{p?.pricing?.unitSale || p?.variantId?.unitSale}</span>{" "}
                        · Estado precio: <span className="text-zinc-200">{p?.pricing?.status || "—"}</span>
                      </p>
                    </div>

                    <span className="text-[11px] rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-zinc-200">
                      {promoLabel}
                    </span>
                  </div>

                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt="promo"
                      className="mt-3 h-40 w-full rounded-xl object-cover border border-white/10"
                    />
                  ) : null}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
                      <p className="text-xs text-zinc-500">Normal</p>
                      <p className="text-sm font-semibold text-zinc-200">{normalPrice != null ? `$ ${normalPrice}` : "—"}</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
                      <p className="text-xs text-zinc-500">Promo</p>
                      <p className="text-sm font-semibold text-zinc-200">
                        {promoPrice != null
                          ? p.type === "BOGO"
                            ? `${p.buyQty || 2} por $ ${promoPrice}`
                            : `$ ${promoPrice}`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-zinc-500">
                      Termina en <span className="text-zinc-200 font-semibold">{formatMs(remaining)}</span>
                    </p>

                    <button
                      onClick={() => togglePromo(p)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                    >
                      {p.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Crear promo - lista de variantes */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold">Crear promoción</p>
          <p className="text-xs text-zinc-500 mt-1">Busca una variante arriba y crea una promo con tiempo límite.</p>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredVariants.map((v) => (
              <button
                key={v._id}
                onClick={() => openCreateModal(v)}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition"
              >
                <p className="text-sm font-semibold">
                  {v?.productId?.name || "—"} <span className="text-zinc-400">· {v?.nameVariant || "—"}</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Unidad: <span className="text-zinc-200">{v?.unitSale || "—"}</span>
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* ✅ Modal unificado */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={modalTitle}
        >
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              {selectedVariant?.productId?.name} · {selectedVariant?.nameVariant} · {selectedVariant?.unitSale}
            </p>

            <div>
              <p className="text-xs text-zinc-500">Tipo</p>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
              >
                <option value="PERCENT_OFF">% OFF</option>
                <option value="BOGO">2x1</option>
              </select>
            </div>

            {form.type === "PERCENT_OFF" ? (
              <div>
                <p className="text-xs text-zinc-500">Porcentaje OFF</p>
                <input
                  type="number"
                  value={form.percentOff}
                  onChange={(e) => setForm((f) => ({ ...f, percentOff: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                  placeholder="Ej: 30"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-zinc-500">Llevás</p>
                  <input
                    type="number"
                    value={form.buyQty}
                    onChange={(e) => setForm((f) => ({ ...f, buyQty: e.target.value }))}
                    className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                    placeholder="2"
                  />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Pagás</p>
                  <input
                    type="number"
                    value={form.payQty}
                    onChange={(e) => setForm((f) => ({ ...f, payQty: e.target.value }))}
                    className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
                    placeholder="1"
                  />
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-zinc-500">Duración (horas)</p>
              <select
                value={form.durationHours}
                onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
              >
                <option value={6}>6</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
                <option value={72}>72</option>
              </select>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Foto (opcional)</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setForm((f) => ({ ...f, imageFile: e.target.files?.[0] || null }))}
                className="mt-1 text-sm text-zinc-200"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Subir: form-data key <span className="text-zinc-200">file</span> (Cloudinary).
              </p>
            </div>

            <button
              disabled={saving}
              onClick={handleCreatePromo}
              className="w-full rounded-xl bg-white text-zinc-950 px-4 py-3 text-sm font-medium text-center disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Crear promoción"}
            </button>
          </div>
        </Modal>
      </motion.div>
    </AppLayout>
  );
}

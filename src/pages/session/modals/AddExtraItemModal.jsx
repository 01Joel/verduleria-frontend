import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/Modal";
import api from "../../../api/api";

function getVariantLabel(v) {
  const prod = v?.productId?.name || "Producto";
  const name = v?.nameVariant || "—";
  const unitBuy = v?.unitBuy || "—";
  const unitSale = v?.unitSale || "—";
  return `${prod} · ${name} · Compra: ${unitBuy} · Venta: ${unitSale}`;
}

export default function AddExtraItemModal({ open, onClose, sessionId, onSuccess }) {
  const [variants, setVariants] = useState([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSelectedId("");
    setError("");
    loadVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadVariants = async () => {
    try {
      const { data } = await api.get("/variants", { params: { active: "true" } });
      setVariants(data?.ok ? data.variants || [] : []);
    } catch {
      setVariants([]);
      setError("No se pudieron cargar variantes.");
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return variants;

    return variants.filter((v) => {
      const prod = (v?.productId?.name || "").toLowerCase();
      const name = (v?.nameVariant || "").toLowerCase();
      const ub = (v?.unitBuy || "").toLowerCase();
      const us = (v?.unitSale || "").toLowerCase();
      return prod.includes(term) || name.includes(term) || ub.includes(term) || us.includes(term);
    });
  }, [variants, q]);

  const submit = async () => {
    if (!sessionId) return;
    if (!selectedId) {
      setError("Selecciona una variante.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.post(`/purchase-sessions/${sessionId}/items`, {
        variantId: selectedId,
        origin: "NO_PLANIFICADO",
        plannedQty: null,
        refPrice: null,
      });

      onClose?.();
      onSuccess?.();
    } catch (e) {
      setError(e?.response?.data?.message || "Error agregando compra adicional.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title="Agregar compra adicional">
      <div className="space-y-3">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div>
          <p className="text-xs text-zinc-500">Buscar</p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition text-sm"
            placeholder="Producto, variante o unidad…"
            disabled={saving}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-2 max-h-80 overflow-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-400 p-2">No hay coincidencias.</p>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 250).map((v) => {
                const id = String(v._id);
                const active = selectedId === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    className={`w-full text-left rounded-xl border px-3 py-2 text-sm transition ${
                      active ? "border-white/30 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                    disabled={saving}
                  >
                    <p className="text-zinc-200">{getVariantLabel(v)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 transition disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            onClick={submit}
            disabled={!selectedId || saving}
            className="flex-1 rounded-xl bg-white text-zinc-950 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Agregando..." : "Agregar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

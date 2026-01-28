// src/pages/session/components/WeighLotGroupModal.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../../components/Modal";
import { weighLot } from "../api/lots";

function isPositiveNumber(x) {
  const n = Number(String(x).trim().replace(",", "."));
  return Number.isFinite(n) && n > 0;
}

function toNumber(x) {
  const n = Number(String(x).trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export default function WeighLotGroupModal({ open, group, onClose, onSuccess }) {
  const [weights, setWeights] = useState({});
  const [bulkValue, setBulkValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const lots = group?.lots || [];
  const inputRefs = useRef({});

  useEffect(() => {
    if (!open) return;
    setWeights({});
    setBulkValue("");
    setSaving(false);
    setError("");
    setSuccessMsg("");

    setTimeout(() => {
      const first = lots[0]?._id;
      if (first && inputRefs.current[first]) inputRefs.current[first].focus();
    }, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const allValid = useMemo(() => {
    if (!lots.length) return false;
    return lots.every((l) => isPositiveNumber(weights[l._id]));
  }, [lots, weights]);

  const setWeight = (lotId, value) => {
    setWeights((prev) => ({ ...prev, [lotId]: value }));
  };

  const fillAll = () => {
    if (!isPositiveNumber(bulkValue)) {
      setError("Ingresa un peso válido para copiar (ej: 19).");
      return;
    }
    setError("");
    const next = {};
    for (const l of lots) next[l._id] = String(bulkValue);
    setWeights(next);

    setTimeout(() => {
      const first = lots[0]?._id;
      if (first && inputRefs.current[first]) inputRefs.current[first].focus();
    }, 50);
  };

  const submit = async () => {
    if (!allValid || saving) return;

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      // ✅ Mejor rendimiento: paralelo (en vez de secuencial)
      const jobs = lots.map((l) => {
        const w = toNumber(weights[l._id]);
        return weighLot(l._id, w);
      });

      await Promise.all(jobs);

      setSuccessMsg("Pesaje registrado para todas las cajas.");
      onSuccess?.();

      setTimeout(() => onClose(), 900);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) setError("No autorizado: solo ADMIN puede registrar el pesaje.");
      else if (status === 409) setError(e?.response?.data?.message || "Conflicto: alguna caja no requiere pesaje.");
      else if (status === 404) setError("No se encontró alguna caja (404). Refresca y reintenta.");
      else setError(e?.response?.data?.message || e?.message || "Error al registrar pesaje.");
    } finally {
      setSaving(false);
    }
  };

  const handleEnter = (e, index) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const nextLot = lots[index + 1];
    if (nextLot?._id && inputRefs.current[nextLot._id]) {
      inputRefs.current[nextLot._id].focus();
      return;
    }

    if (index === lots.length - 1 && allValid && !saving && !successMsg) {
      submit();
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving || successMsg ? () => {} : onClose}
      title="Pesar cajas"
    >
      <div className="flex flex-col max-h-[75vh] sm:max-h-[78vh]">
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
              {successMsg}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/10 overflow-hidden border border-white/10 flex-shrink-0">
                {group?.productImg ? (
                  <img
                    src={group.productImg}
                    alt={group.productName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {group?.productName || "Producto"}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5 truncate">
                  {group?.variantName || "—"} · Proveedor: {group?.supplierName || "—"}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Cajas pendientes: <span className="text-zinc-200">{lots.length}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-zinc-400">
              Si todas pesan igual, ingresa una vez y copia.
            </p>

            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <input
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                className="w-full sm:flex-1 rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
                inputMode="decimal"
                placeholder="Peso (Kg) para todas"
                disabled={saving || !!successMsg}
              />
              <button
                onClick={fillAll}
                disabled={saving || !!successMsg}
                className="w-full sm:w-auto rounded-xl bg-white text-zinc-950 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                Copiar a todas
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {lots.map((l, idx) => (
              <div
                key={l._id}
                className="rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Caja {idx + 1}
                    <span className="text-[11px] text-zinc-500 ml-2">
                      ({l._id.slice(-6)})
                    </span>
                  </p>
                  <span className="text-[11px] text-zinc-500">
                    unitCost: {l.unitCost}
                  </span>
                </div>

                <div className="mt-2">
                  <label className="text-xs text-zinc-300">Peso neto (Kg)</label>
                  <input
                    ref={(el) => (inputRefs.current[l._id] = el)}
                    value={weights[l._id] ?? ""}
                    onChange={(e) => setWeight(l._id, e.target.value)}
                    onKeyDown={(e) => handleEnter(e, idx)}
                    className="mt-1 w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 transition"
                    inputMode="decimal"
                    placeholder="Ej: 19"
                    disabled={saving || !!successMsg}
                  />
                </div>

                {!isPositiveNumber(weights[l._id]) && (weights[l._id] ?? "") !== "" && (
                  <p className="text-[11px] text-red-200/80 mt-1">
                    Peso inválido. Debe ser mayor a 0.
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="h-2" />
        </div>

        <div className="pt-3 border-t border-white/10 bg-black/20 backdrop-blur rounded-b-2xl">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving || !!successMsg}
              className="w-40 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 transition disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              onClick={submit}
              disabled={!allValid || saving || !!successMsg}
              className="flex-1 rounded-xl bg-white text-zinc-950 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar pesajes"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

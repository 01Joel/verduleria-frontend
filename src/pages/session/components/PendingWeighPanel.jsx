// src/pages/session/components/PendingWeighPanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { listLotsBySession } from "../api/lots";
import WeighLotGroupModal from "./WeighLotGroupModal";

function buildGroupKey(lot) {
  const variantId = lot?.variantId?._id || lot?.variantId || "no-variant";
  const supplierId = lot?.supplierId?._id || lot?.supplierId || "no-supplier";
  return `${variantId}__${supplierId}`;
}

export default function PendingWeighPanel({ sessionId, onReload }) {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);

  const [openGroup, setOpenGroup] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);

  // ✅ guard contra cargas concurrentes (interval + click)
  const inFlightRef = useRef(false);

  const load = async () => {
    if (!sessionId) return;
    if (inFlightRef.current) return;

    try {
      inFlightRef.current = true;
      setLoading(true);
      const data = await listLotsBySession(sessionId);
      setLots(data?.lots || []);
    } catch {
      setLots([]);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Auto refresh (evita tocar "Actualizar")
  useEffect(() => {
    if (!sessionId) return;
    const id = setInterval(() => load(), 15000); // 15s
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const pendingLots = useMemo(() => {
    return lots.filter((l) => l.buyUnit === "CAJA" && !l.weighedAt);
  }, [lots]);

  const groups = useMemo(() => {
    const map = new Map();

    for (const lot of pendingLots) {
      const key = buildGroupKey(lot);

      if (!map.has(key)) {
        const product = lot?.variantId?.productId;
        const variant = lot?.variantId;

        map.set(key, {
          key,
          variantId: variant?._id || lot?.variantId,
          supplierId: lot?.supplierId?._id || lot?.supplierId,
          productName: product?.name || "Producto",
          productImg: product?.imageUrl || "",
          variantName: variant?.nameVariant || "—",
          supplierName: lot?.supplierId?.nickname || "—",
          lots: [],
        });
      }

      map.get(key).lots.push(lot);
    }

    return Array.from(map.values()).sort((a, b) => b.lots.length - a.lots.length);
  }, [pendingLots]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Pendientes de pesaje</p>
          <p className="text-xs text-zinc-500">
            Agrupado por producto. Toca para pesar varias cajas.
          </p>
        </div>

        <button
          onClick={load}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {groups.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-3">
            No hay cajas pendientes.
          </p>
        )}

        {groups.map((g) => (
          <button
            key={g.key}
            onClick={() => {
              setActiveGroup(g);
              setOpenGroup(true);
            }}
            className="w-full text-left rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/10 overflow-hidden flex-shrink-0 border border-white/10">
                {g.productImg ? (
                  <img
                    src={g.productImg}
                    alt={g.productName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{g.productName}</p>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  {g.variantName} · Proveedor: {g.supplierName}
                </p>

                <p className="text-[11px] text-zinc-500 mt-1">
                  Pendientes: <span className="text-zinc-200">{g.lots.length}</span>{" "}
                  caja(s)
                </p>
              </div>

              <span className="text-[11px] rounded-lg bg-yellow-500/10 text-yellow-300 px-2 py-1 flex-shrink-0">
                Pendiente
              </span>
            </div>
          </button>
        ))}
      </div>

      <WeighLotGroupModal
        open={openGroup}
        group={activeGroup}
        onClose={() => {
          setOpenGroup(false);
          setActiveGroup(null);
        }}
        onSuccess={() => {
          setOpenGroup(false);
          setActiveGroup(null);
          load(); // refresca pendientes
          onReload?.(); // refresca items si aplica
        }}
      />
    </div>
  );
}

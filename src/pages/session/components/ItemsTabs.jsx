import { useMemo, useState } from "react";
import ItemCard from "./ItemCard";
import AddExtraItemModal from "../modals/AddExtraItemModal";

function colorClassForKey(key) {
  const palette = [
    "bg-cyan-500/15 text-cyan-200 border-cyan-500/25",
    "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/25",
    "bg-emerald-500/15 text-emerald-200 border-emerald-500/25",
    "bg-amber-500/15 text-amber-200 border-amber-500/25",
    "bg-violet-500/15 text-violet-200 border-violet-500/25",
    "bg-sky-500/15 text-sky-200 border-sky-500/25",
    "bg-lime-500/15 text-lime-200 border-lime-500/25",
    "bg-rose-500/15 text-rose-200 border-rose-500/25",
  ];
  const s = String(key || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function formatARS(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function pickFilaD(item) {
  const n = Number(item?.refPrice);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function productKey(item) {
  const p = item?.variantId?.productId;
  return p?._id || "no-product";
}
function productName(item) {
  return item?.variantId?.productId?.name || "Producto";
}
function variantName(item) {
  return item?.variantId?.nameVariant || "";
}

export default function ItemsTabs({ session, items, onReload }) {
  const [tab, setTab] = useState("PLANIFICADO");
  const [openAddExtra, setOpenAddExtra] = useState(false);

  const actionsEnabled = session?.status === "ABIERTA";

  const filtered = useMemo(
    () => (items || []).filter((i) => i.origin === tab),
    [items, tab]
  );

  const groups = useMemo(() => {
    const map = new Map();

    for (const it of filtered) {
      const key = productKey(it);

      if (!map.has(key)) {
        map.set(key, {
          key,
          productId: key,
          productName: productName(it),
          colorClass: colorClassForKey(key),
          items: [],
        });
      }
      map.get(key).items.push(it);
    }

    const arr = Array.from(map.values()).map((g) => {
      const sorted = g.items.slice().sort((a, b) => {
        return variantName(a).localeCompare(variantName(b), "es");
      });
      const sumD = sorted.reduce((acc, it) => acc + pickFilaD(it), 0);
      return { ...g, items: sorted, sumD };
    });

    arr.sort((a, b) => a.productName.localeCompare(b.productName, "es"));
    return arr;
  }, [filtered]);

  const totalD = useMemo(
    () => filtered.reduce((acc, it) => acc + pickFilaD(it), 0),
    [filtered]
  );

  const globalIndexById = useMemo(() => {
    const map = new Map();
    let idx = 1;
    for (const g of groups) {
      for (const it of g.items) {
        map.set(it._id, idx);
        idx += 1;
      }
    }
    return map;
  }, [groups]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[
          { key: "PLANIFICADO", label: "Lista de compras" },
          { key: "NO_PLANIFICADO", label: "Compra adicional" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm border transition
              ${
                tab === t.key
                  ? "bg-white text-zinc-950"
                  : "bg-white/5 border-white/10 text-zinc-300"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CTA compra adicional */}
      {tab === "NO_PLANIFICADO" && actionsEnabled && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-200 font-semibold">Compra adicional</p>
            <p className="text-xs text-zinc-500 mt-1">
              Agrega una variante extra a esta sesión sin pasar por planificación.
            </p>
          </div>

          <button
            onClick={() => setOpenAddExtra(true)}
            className="rounded-xl bg-white text-zinc-950 px-4 py-2 text-sm font-medium"
          >
            Agregar
          </button>
        </div>
      )}

      {/* Total Fila D */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
          <p className="text-xs text-zinc-400">Total (sugerido)</p>
          <p className="text-sm font-semibold text-zinc-200">{formatARS(totalD)}</p>
        </div>
      )}

      {/* Lista por producto */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-4">
            No hay ítems en esta sección
          </p>
        )}

        {groups.map((g) => (
          <div key={g.key} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[11px] rounded-lg border px-2 py-1 ${g.colorClass} flex-shrink-0`}
                >
                  Producto
                </span>
                <p className="text-sm font-semibold text-zinc-200 truncate">
                  {g.productName}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-[11px] text-zinc-500">{g.items.length} variante(s)</p>
                <p className="text-xs text-zinc-200 font-semibold">
                  {formatARS(g.sumD)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {g.items.map((item) => (
                <ItemCard
                  key={item._id}
                  session={session}
                  item={item}
                  actionsEnabled={actionsEnabled}
                  onReload={onReload}
                  number={globalIndexById.get(item._id)}
                  numberClass={g.colorClass}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal: agregar compra adicional */}
      <AddExtraItemModal
        open={openAddExtra}
        onClose={() => setOpenAddExtra(false)}
        sessionId={session?._id}
        onSuccess={onReload}
      />
    </div>
  );
}

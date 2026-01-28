import { Link } from "react-router-dom";

function formatDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return "—";
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return "—";

  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

export default function SessionHeader({ session }) {
  const statusColor = {
    PLANIFICACION: "bg-blue-500/10 text-blue-300",
    ABIERTA: "bg-green-500/10 text-green-300",
    CERRADA: "bg-red-500/10 text-red-300",
  };

  const dateLabel = formatDateKey(session?.dateKey);
  const canGoResumen = session?.status === "ABIERTA" || session?.status === "CERRADA";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-400">Sesión de compra</p>
          <p className="text-sm font-medium">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {canGoResumen && (
            <Link
              to="/session/resumen"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
            >
              Ir a Resumen
            </Link>
          )}

          <span
            className={`text-xs rounded-xl px-3 py-1 border border-white/10 ${statusColor[session?.status]}`}
          >
            {session?.status}
          </span>
        </div>
      </div>
    </div>
  );
}

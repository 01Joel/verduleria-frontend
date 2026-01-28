export default function SessionModeChips({ mode, onChange, showClosed = false }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChange("ABIERTA")}
        className={`flex-1 rounded-xl px-3 py-2 text-sm border transition
          ${
            mode === "ABIERTA"
              ? "bg-white text-zinc-950"
              : "bg-white/5 border-white/10 text-zinc-300"
          }`}
      >
        Operativa
      </button>

      <button
        onClick={() => onChange("PLANIFICACION")}
        className={`flex-1 rounded-xl px-3 py-2 text-sm border transition
          ${
            mode === "PLANIFICACION"
              ? "bg-white text-zinc-950"
              : "bg-white/5 border-white/10 text-zinc-300"
          }`}
      >
        Planificación
      </button>

      {showClosed && (
        <button
          onClick={() => onChange("CERRADA")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm border transition
            ${
              mode === "CERRADA"
                ? "bg-white text-zinc-950"
                : "bg-white/5 border-white/10 text-zinc-300"
            }`}
        >
          Cerrada
        </button>
      )}
    </div>
  );
}

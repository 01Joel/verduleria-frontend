export default function GlowBackground({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden text-zinc-100 bg-[#1e2626]">
      {/* Base gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1e2626] via-[#182020] to-[#111616]" />

      {/* Spotlight / vignette (más suave en mobile) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90 sm:opacity-95"
        style={{
          background:
            "radial-gradient(700px 420px at 50% 0%, rgba(255,255,255,0.06), transparent 60%), radial-gradient(760px 520px at 18% 28%, rgba(34,197,94,0.10), transparent 60%), radial-gradient(820px 560px at 82% 38%, rgba(16,185,129,0.08), transparent 60%)",
        }}
      />

      {/* Glows responsive: en mobile más centrados y chicos */}
      <div
        className="
          pointer-events-none absolute rounded-full
          bg-emerald-400/10
          blur-2xl sm:blur-3xl
          h-[18rem] w-[18rem] sm:h-[28rem] sm:w-[28rem]
          -top-16 -left-10 sm:-top-28 sm:-left-28
        "
      />
      <div
        className="
          pointer-events-none absolute rounded-full
          bg-green-300/10
          blur-2xl sm:blur-3xl
          h-[20rem] w-[20rem] sm:h-[30rem] sm:w-[30rem]
          top-24 -right-12 sm:top-32 sm:-right-28
        "
      />
      <div
        className="
          pointer-events-none absolute rounded-full
          bg-white/5
          blur-2xl sm:blur-3xl
          h-[22rem] w-[22rem] sm:h-[34rem] sm:w-[34rem]
          -bottom-28 left-1/4 sm:-bottom-40 sm:left-1/3
        "
      />

      {/* Grid: más discreto en mobile */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] sm:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(16,185,129,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Noise: bajarlo en mobile para que no “ensucie” */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] sm:opacity-[0.06] mix-blend-soft-light"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'160\' height=\'160\' filter=\'url(%23n)\' opacity=\'.35\'/%3E%3C/svg%3E")',
        }}
      />

      <div className="relative">{children}</div>
    </div>
  );
}

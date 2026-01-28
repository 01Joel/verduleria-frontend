export default function StatCard({ title, value, desc }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <p className="text-xs text-zinc-400">{title}</p>
      <p className="mt-1 text-sm sm:text-base font-medium">{value}</p>
      {desc && <p className="mt-2 text-xs text-zinc-500">{desc}</p>}
    </div>
  );
}

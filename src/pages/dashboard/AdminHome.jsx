import AppLayout from "../../components/AppLayout";

export default function AdminHome() {
  return (
    <AppLayout>
      <h2 className="text-xl font-semibold tracking-tight">Panel ADMIN</h2>
      <p className="text-sm text-zinc-400 mt-2">
        Aquí irán: margen global, DailyPrice, gestión futura de promos (2x1), etc.
      </p>
    </AppLayout>
  );
}

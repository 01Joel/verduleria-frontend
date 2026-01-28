import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAppStore();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-3"
        >
          <div className="h-9 w-9 rounded-xl border border-white/10 bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.08)]" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">
              Control de Verdulería
            </p>
            <p className="text-[11px] text-zinc-400">
              {user?.username} · {user?.role}
            </p>
          </div>
        </motion.div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] text-zinc-400">Rol</span>
        
          <span className="hidden sm:inline text-[11px] rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-zinc-200">
            {user?.role}
          </span>
        
          <button
            onClick={onLogout}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition"
          >
            <span className="sm:hidden">Salir</span>
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}

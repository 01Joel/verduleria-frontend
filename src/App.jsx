import { motion } from "framer-motion";

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center">
      <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/30 blur-3xl" />
      <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl"
      >
        <h1 className="text-xl font-semibold">TEST GLOW + ANIM</h1>
        <p className="text-white/70 mt-2">
          Si ves glow + tarjeta translúcida, Tailwind ya está OK.
        </p>
      </motion.div>
    </div>
  );
}

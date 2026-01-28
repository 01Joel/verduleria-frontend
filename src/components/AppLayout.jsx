import GlowBackground from "./GlowBackground";
import Navbar from "./Navbar";

export default function AppLayout({ children }) {
  return (
    <GlowBackground>
      <Navbar />
      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>
    </GlowBackground>
  );
}


// ══════════════════════════════════════════════════════════════════
//  KIDORA — Layout des pages de jeu (contenu recentré, lecture)
// ══════════════════════════════════════════════════════════════════

import { Outlet } from "react-router-dom";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";

export function GameLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

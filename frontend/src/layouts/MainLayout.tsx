// ══════════════════════════════════════════════════════════════════
//  KIDORA — Layout principal (Navbar + contenu + Footer)
// ══════════════════════════════════════════════════════════════════

import { Outlet } from "react-router-dom";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";

export function MainLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

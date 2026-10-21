// ══════════════════════════════════════════════════════════════════
//  KIDORA — Layout de l'administration (§26)
// ══════════════════════════════════════════════════════════════════

import { Outlet } from "react-router-dom";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { useI18n } from "../i18n";

export function AdminLayout() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl">🛠️ {t("admin.title")}</h1>
          <p className="text-ink-soft">{t("admin.subtitle")}</p>
        </div>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

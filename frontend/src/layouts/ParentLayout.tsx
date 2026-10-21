// ══════════════════════════════════════════════════════════════════
//  KIDORA — Layout de l'espace parents (§25)
// ══════════════════════════════════════════════════════════════════

import { NavLink, Outlet } from "react-router-dom";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { ROUTES } from "../config";
import { useI18n } from "../i18n";
import { cn } from "../utils/cn";

export function ParentLayout() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">{t("parent.title")}</h1>
            <p className="text-ink-soft">{t("parent.subtitle")}</p>
          </div>
          <NavLink
            to={ROUTES.parent}
            end
            className={({ isActive }) =>
              cn("btn btn-outline btn-sm", isActive && "border-primary bg-primary-soft")
            }
          >
            <span aria-hidden="true">👧</span> {t("parent.children")}
          </NavLink>
        </div>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

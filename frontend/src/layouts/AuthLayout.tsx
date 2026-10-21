// ══════════════════════════════════════════════════════════════════
//  KIDORA — Layout des pages d'authentification
//  Centré, épuré, sans distractions — sons et langue accessibles.
// ══════════════════════════════════════════════════════════════════

import { Link, Outlet } from "react-router-dom";
import { LanguageSwitcher } from "../components/layout/LanguageSwitcher";
import { SoundToggle } from "../components/layout/SoundToggle";
import { ROUTES, SITE_NAME } from "../config";

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to={ROUTES.home} className="flex items-center gap-2 no-select" aria-label={SITE_NAME}>
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-xl text-white shadow-soft"
            aria-hidden="true"
          >
            🦉
          </span>
          <span className="text-xl font-bold text-primary">{SITE_NAME}</span>
        </Link>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10">
        <Outlet />
      </main>
    </div>
  );
}

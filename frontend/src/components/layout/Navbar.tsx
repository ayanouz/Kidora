// ══════════════════════════════════════════════════════════════════
//  KIDORA — Barre de navigation
//  Logo, liens principaux, sons, langue, profil, menu mobile.
//  Sticky, contrastée, gros boutons — utilisable dès 320 px.
// ══════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ROUTES, SITE_NAME } from "../../config";
import { useI18n } from "../../i18n";
import { cn } from "../../utils/cn";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { SoundToggle } from "./SoundToggle";

interface NavItem {
  to: string;
  label: string;
  emoji: string;
  end?: boolean;
}

export function Navbar() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    { to: ROUTES.home, label: t("nav.home"), emoji: "🏠", end: true },
    { to: ROUTES.games, label: t("nav.games"), emoji: "🎮" },
    { to: ROUTES.categories, label: t("nav.categories"), emoji: "🗂️" },
    { to: ROUTES.premium, label: t("premium.nav"), emoji: "👑" },
    { to: ROUTES.leaderboard, label: t("leaderboard.title"), emoji: "🏆" },
    { to: ROUTES.favorites, label: t("nav.favorites"), emoji: "❤️" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2 sm:px-6">
        <Link
          to={ROUTES.home}
          className="flex items-center gap-2 no-select"
          aria-label={SITE_NAME}
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-xl text-white shadow-soft"
            aria-hidden="true"
          >
            🦉
          </span>
          <span className="text-xl font-bold text-primary">{SITE_NAME}</span>
        </Link>

        <nav className="ms-4 hidden items-center gap-0.5 lg:flex" aria-label={t("nav.menu")}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn("btn btn-ghost btn-sm", isActive && "bg-primary-soft text-primary-dark")
              }
            >
              <span aria-hidden="true">{item.emoji}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1.5">
          <SoundToggle />
          <LanguageSwitcher className="hidden sm:block" />
          <ProfileSwitcher />
          <button
            type="button"
            className="btn btn-ghost btn-icon text-2xl lg:hidden"
            aria-expanded={open}
            aria-label={t("nav.menu")}
            title={t("nav.menu")}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav
          className="border-t border-primary/10 bg-white shadow-soft lg:hidden"
          aria-label={t("nav.menu")}
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-3 py-3 sm:px-6">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn("btn btn-ghost justify-start text-base", isActive && "bg-primary-soft text-primary-dark")
                }
              >
                <span aria-hidden="true">{item.emoji}</span>
                {item.label}
              </NavLink>
            ))}
            <div className="mt-1 sm:hidden">
              <LanguageSwitcher className="w-full" />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

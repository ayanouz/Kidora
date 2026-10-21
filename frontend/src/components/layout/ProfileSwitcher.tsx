// ══════════════════════════════════════════════════════════════════
//  KIDORA — Menu du profil (§6/§7)
//  • Invité : Connexion / Inscription
//  • Connecté : changement de profil enfant + raccourcis + déconnexion
//  <details> natif = accessible au clavier, zéro dépendance.
// ══════════════════════════════════════════════════════════════════

import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../ui/Display";
import { ROUTES } from "../../config";
import { useI18n } from "../../i18n";
import { useAuthStore } from "../../store/auth.store";
import { cn } from "../../utils/cn";

function MenuLink({
  to,
  label,
  icon,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-soft"
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </Link>
  );
}

export function ProfileSwitcher() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const profiles = useAuthStore((s) => s.profiles);
  const activeProfile = useAuthStore((s) => s.activeProfile);
  const selectProfile = useAuthStore((s) => s.selectProfile);
  const logout = useAuthStore((s) => s.logout);

  const close = () => detailsRef.current?.removeAttribute("open");

  if (status === "loading") {
    return <div className="h-11 w-11 animate-pulse rounded-full bg-primary/10" aria-hidden="true" />;
  }

  if (status !== "authenticated" || !user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link to={ROUTES.login} className="btn btn-ghost btn-sm">
          {t("nav.login")}
        </Link>
        <Link to={ROUTES.register} className="btn btn-primary btn-sm">
          {t("nav.register")}
        </Link>
      </div>
    );
  }

  const avatar = activeProfile?.avatar ?? user.avatar;
  const name = activeProfile?.displayName ?? user.displayName;

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-white/80 p-1 pe-2.5 shadow-soft transition-shadow hover:shadow-pop [&::-webkit-details-marker]:hidden"
        aria-label={t("profile.switchProfile")}
      >
        <Avatar emoji={avatar} size="sm" label={name} />
        <span className="hidden max-w-[8rem] truncate text-sm font-bold sm:inline">{name}</span>
        <span className="text-xs text-ink-soft" aria-hidden="true">
          ▾
        </span>
      </summary>

      <div
        className="absolute end-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-pop"
        onClick={close}
      >
        {profiles.length > 0 && (
          <ul className="max-h-56 overflow-y-auto border-b border-primary/10 py-1">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  onClick={() => void selectProfile(profile.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-start text-sm font-semibold transition-colors hover:bg-primary-soft",
                    profile.id === activeProfile?.id && "bg-primary-soft/70",
                  )}
                >
                  <span className="text-lg" aria-hidden="true">
                    {profile.avatar}
                  </span>
                  <span className="flex-1 truncate">{profile.displayName}</span>
                  {profile.id === activeProfile?.id && (
                    <span className="text-primary" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col border-b border-primary/10 p-1">
          <MenuLink to={ROUTES.profile} label={t("nav.profile")} icon="🙂" onNavigate={close} />
          <MenuLink to={ROUTES.favorites} label={t("nav.favorites")} icon="❤️" onNavigate={close} />
          <MenuLink to={ROUTES.achievements} label={t("achievements.title")} icon="🏅" onNavigate={close} />
          <MenuLink to={ROUTES.settings} label={t("nav.settings")} icon="⚙️" onNavigate={close} />
          {(user.role === "PARENT" || user.role === "ADMIN") && (
            <MenuLink to={ROUTES.parent} label={t("nav.parent")} icon="👨‍👩‍👧" onNavigate={close} />
          )}
          {user.role === "ADMIN" && (
            <MenuLink to={ROUTES.admin} label={t("nav.admin")} icon="🛠️" onNavigate={close} />
          )}
        </div>

        <div className="p-1">
          <button
            type="button"
            onClick={() => {
              void logout().then(() => navigate(ROUTES.home));
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
          >
            <span aria-hidden="true">🚪</span>
            {t("nav.logout")}
          </button>
        </div>
      </div>
    </details>
  );
}

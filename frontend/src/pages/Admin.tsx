// ══════════════════════════════════════════════════════════════════
//  KIDORA — Administration (§26)
//  Onglets : vue d'ensemble, utilisateurs, jeux, catégories, sécurité.
//  Toutes les actions passent par l'API admin (jamais de données
//  sensibles en clair, journalisation côté serveur).
// ══════════════════════════════════════════════════════════════════

import { useState, type ReactNode } from "react";
import { Button } from "../components/ui/Button";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";
import { adminService, type AdminCategoryInput } from "../services/admin.service";
import { useAsync, useDebouncedValue, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { cn } from "../utils/cn";
import { formatMs } from "../games/engine/components";
import type { AdminUser } from "../types";

type TabKey = "stats" | "users" | "games" | "categories" | "security";

function formatDate(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card p-5", className)}>
      <h2 className="mb-3 text-xl">{title}</h2>
      {children}
    </section>
  );
}

// ── Vue d'ensemble ────────────────────────────────────────────────

function StatsTab() {
  const { t } = useI18n();
  const stats = useAsync(async () => adminService.stats(), []);

  if (stats.loading) return <Spinner className="py-16" />;
  if (stats.error || !stats.data) return <ErrorState onRetry={stats.reload} />;

  const s = stats.data;
  const boxes: [string, string, string | number][] = [
    ["👥", t("admin.usersTotal"), s.users.total],
    ["🆕", t("admin.usersNew7d"), s.users.new7d],
    ["🧒", t("admin.childProfiles"), s.users.childProfiles],
    ["⚡", t("admin.usersActive7d"), s.users.active7d],
    ["🎮", t("admin.sessionsTotal"), s.sessions.total],
    ["📅", t("admin.sessions7d"), s.sessions.last7d],
    ["⏱️", t("admin.avgDuration"), formatMs(s.sessions.avgDurationMs)],
    ["🏅", t("admin.totalScores"), s.sessions.totalScores],
    ["🕹️", t("admin.gamesTotal"), s.games.total],
    ["✅", t("admin.gamesPublished"), s.games.published],
    ["🛡️", t("admin.anomalies30d"), s.security.scoreAnomalies30d],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {boxes.map(([emoji, label, value]) => (
          <div key={label} className="card flex items-center gap-3 p-4">
            <span className="text-2xl" aria-hidden="true">
              {emoji}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {label}
              </span>
              <span className="block text-xl font-bold tabular-nums">{value}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title={t("admin.topPlayed")}>
          <ol className="flex flex-col gap-2 text-sm font-semibold">
            {s.topPlayed.map((game, index) => (
              <li key={game.slug} className="flex items-center gap-2">
                <span className="w-5 text-center text-ink-faint">{index + 1}</span>
                <span aria-hidden="true">{game.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{game.title}</span>
                <span className="tabular-nums text-primary">{game.playCount}</span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title={t("admin.topWinRates")}>
          <ol className="flex flex-col gap-2 text-sm font-semibold">
            {s.topWinRates.map((row) => (
              <li key={row.id} className="flex items-center gap-2">
                <span aria-hidden="true">{row.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{row.title}</span>
                <span className="tabular-nums text-secondary-dark">
                  {Math.round(row.winRate)}%
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title={t("admin.topAbandoned")}>
          <ol className="flex flex-col gap-2 text-sm font-semibold">
            {s.topAbandoned.map((row) => (
              <li key={row.id} className="flex items-center gap-2">
                <span aria-hidden="true">{row.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{row.title}</span>
                <span className="tabular-nums text-danger">{row.abandoned}</span>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Utilisateurs ──────────────────────────────────────────────────

function UsersTab() {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search, 350);
  const [busyId, setBusyId] = useState<string | null>(null);

  const users = useAsync(
    async () => adminService.users({ search: debounced || undefined, page, limit: 20 }),
    [debounced, page],
  );

  const toggleActive = async (user: AdminUser) => {
    setBusyId(user.id);
    try {
      await adminService.setUserActive(user.id, !user.isActive);
      users.reload();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (user: AdminUser) => {
    if (!window.confirm(`${t("admin.confirmDelete")} ${t("admin.deleteWarning")}`)) return;
    setBusyId(user.id);
    try {
      await adminService.deleteUser(user.id);
      users.reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        className="input max-w-md"
        placeholder={t("admin.searchPlaceholder")}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        aria-label={t("common.search")}
      />

      {users.loading && <Spinner className="py-12" />}
      {users.error && <ErrorState onRetry={users.reload} />}
      {users.data && users.data.users.length === 0 && (
        <EmptyState icon="👤" title={t("admin.empty")} />
      )}

      {users.data && users.data.users.length > 0 && (
        <ul className="flex flex-col gap-2">
          {users.data.users.map((user) => (
            <li key={user.id} className="card flex flex-wrap items-center gap-3 p-3">
              <span className="text-2xl" aria-hidden="true">
                {user.avatar}
              </span>
              <span className="min-w-[12rem] flex-1">
                <span className="block truncate font-bold">{user.displayName}</span>
                <span className="block truncate text-xs text-ink-faint">{user.email ?? "—"}</span>
              </span>
              <span className="chip bg-primary-soft text-xs text-primary-dark">{user.role}</span>
              <span className="text-xs font-semibold text-ink-soft tabular-nums">
                👧 {user.profilesCount}
              </span>
              <span
                className={cn(
                  "chip text-xs",
                  user.isActive ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                )}
              >
                {user.isActive ? t("admin.active") : t("admin.inactive")}
              </span>
              <span className="hidden text-xs text-ink-faint sm:inline">
                {t("admin.created")} {formatDate(user.createdAt, lang)}
              </span>
              <span className="ms-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={busyId === user.id}
                  onClick={() => void toggleActive(user)}
                >
                  {user.isActive ? t("admin.disable") : t("admin.enable")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busyId === user.id}
                  onClick={() => void remove(user)}
                >
                  🗑️
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {users.data && users.data.pages > 1 && (
        <nav className="flex items-center justify-center gap-4" aria-label={t("admin.tabUsers")}>
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ←
          </Button>
          <span className="text-sm font-bold text-ink-soft tabular-nums">
            {users.data.page} {t("common.of")} {users.data.pages}
          </span>
          <Button
            variant="outline"
            disabled={page >= users.data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </Button>
        </nav>
      )}
    </div>
  );
}

// ── Jeux ──────────────────────────────────────────────────────────

function GamesTab() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search, 350);
  const [busyId, setBusyId] = useState<string | null>(null);

  const games = useAsync(
    async () => adminService.games({ search: debounced || undefined, page, limit: 20 }),
    [debounced, page],
  );

  const togglePublished = async (id: string, isPublished: boolean) => {
    setBusyId(id);
    try {
      await adminService.updateGame(id, { isPublished: !isPublished });
      games.reload();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(`${t("admin.confirmDelete")} ${t("admin.deleteWarning")}`)) return;
    setBusyId(id);
    try {
      await adminService.deleteGame(id);
      games.reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        className="input max-w-md"
        placeholder={t("admin.searchPlaceholder")}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        aria-label={t("common.search")}
      />

      {games.loading && <Spinner className="py-12" />}
      {games.error && <ErrorState onRetry={games.reload} />}

      {games.data && (
        <ul className="flex flex-col gap-2">
          {games.data.games.map((game) => (
            <li key={game.id} className="card flex flex-wrap items-center gap-3 p-3">
              <span className="text-2xl" aria-hidden="true">
                {game.emoji}
              </span>
              <span className="min-w-[12rem] flex-1">
                <span className="block truncate font-bold">{game.title}</span>
                <span className="block truncate text-xs text-ink-faint">
                  {game.slug} · {t("admin.engine")}: {game.engine}
                </span>
              </span>
              <span className="chip bg-primary-soft text-xs text-primary-dark">
                {game.category.emoji} {game.category.name}
              </span>
              <span className="text-xs font-semibold text-ink-soft tabular-nums">
                🎮 {game.playCount}
              </span>
              <span
                className={cn(
                  "chip text-xs",
                  game.isPublished ? "bg-success-soft text-success" : "bg-accent-soft text-ink",
                )}
              >
                {game.isPublished ? t("admin.published") : t("admin.unpublished")}
              </span>
              <span className="ms-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={busyId === game.id}
                  onClick={() => void togglePublished(game.id, game.isPublished)}
                >
                  {game.isPublished ? t("admin.unpublish") : t("admin.publish")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busyId === game.id}
                  onClick={() => void remove(game.id)}
                >
                  🗑️
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {games.data && games.data.pages > 1 && (
        <nav className="flex items-center justify-center gap-4" aria-label={t("admin.tabGames")}>
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ←
          </Button>
          <span className="text-sm font-bold text-ink-soft tabular-nums">
            {games.data.page} {t("common.of")} {games.data.pages}
          </span>
          <Button
            variant="outline"
            disabled={page >= games.data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </Button>
        </nav>
      )}
    </div>
  );
}

// ── Catégories ────────────────────────────────────────────────────

const EMPTY_CATEGORY: AdminCategoryInput = {
  slug: "",
  name: "",
  emoji: "🎮",
  color: "#6C5CE7",
  sortOrder: 0,
};

function CategoriesTab() {
  const { t } = useI18n();
  const categories = useAsync(async () => adminService.categories(), []);
  const [form, setForm] = useState<AdminCategoryInput>(EMPTY_CATEGORY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!form.slug.trim() || !form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adminService.createCategory(form);
      setForm(EMPTY_CATEGORY);
      categories.reload();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setBusy(true);
    try {
      await adminService.updateCategory(id, { isActive: !isActive });
      categories.reload();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(`${t("admin.confirmDelete")} ${t("admin.deleteWarning")}`)) return;
    setBusy(true);
    try {
      await adminService.deleteCategory(id);
      categories.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title={`➕ ${t("admin.tabCategories")}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="input"
            placeholder={t("admin.slug")}
            value={form.slug}
            onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value }))}
            aria-label={t("admin.slug")}
          />
          <input
            className="input"
            placeholder={t("admin.name")}
            value={form.name}
            onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
            aria-label={t("admin.name")}
          />
          <input
            className="input"
            placeholder={t("admin.emoji")}
            value={form.emoji}
            maxLength={4}
            onChange={(event) => setForm((f) => ({ ...f, emoji: event.target.value }))}
            aria-label={t("admin.emoji")}
          />
          <input
            type="color"
            className="input h-12 cursor-pointer p-1"
            value={form.color}
            onChange={(event) => setForm((f) => ({ ...f, color: event.target.value }))}
            aria-label={t("admin.color")}
          />
          <Button onClick={() => void create()} loading={busy} disabled={!form.slug || !form.name}>
            {t("common.save")}
          </Button>
        </div>
        {error && (
          <p className="mt-2 text-sm font-semibold text-danger" role="alert">
            {error}
          </p>
        )}
      </SectionCard>

      {categories.loading && <Spinner className="py-12" />}
      {categories.error && <ErrorState onRetry={categories.reload} />}

      {categories.data && (
        <ul className="flex flex-col gap-2">
          {categories.data.categories.map((category) => (
            <li key={category.id} className="card flex flex-wrap items-center gap-3 p-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                style={{ background: `${category.color}22` }}
                aria-hidden="true"
              >
                {category.emoji}
              </span>
              <span className="min-w-[10rem] flex-1">
                <span className="block truncate font-bold">{category.name}</span>
                <span className="block text-xs text-ink-faint">{category.slug}</span>
              </span>
              <span className="chip bg-primary-soft text-xs text-primary-dark">
                🎮 {category._count.games}
              </span>
              <span className="text-xs font-semibold text-ink-soft">
                {t("admin.sortOrder")}: {category.sortOrder}
              </span>
              <span
                className={cn(
                  "chip text-xs",
                  category.isActive ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                )}
              >
                {category.isActive ? t("admin.active") : t("admin.inactive")}
              </span>
              <span className="ms-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void toggleActive(category.id, category.isActive)}
                >
                  {category.isActive ? t("admin.disable") : t("admin.enable")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy || category._count.games > 0}
                  title={category._count.games > 0 ? t("admin.deleteWarning") : undefined}
                  onClick={() => void remove(category.id)}
                >
                  🗑️
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Sécurité ──────────────────────────────────────────────────────

function SecurityTab() {
  const { t, lang } = useI18n();
  const logs = useAsync(async () => adminService.securityLogs(50), []);

  if (logs.loading) return <Spinner className="py-12" />;
  if (logs.error || !logs.data) return <ErrorState onRetry={logs.reload} />;

  if (logs.data.logs.length === 0) {
    return <EmptyState icon="🛡️" title={t("admin.noLogs")} />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {logs.data.logs.map((log) => (
        <li key={log.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="chip bg-warning-soft text-xs text-warning">{log.type}</span>
          <span className="text-xs text-ink-faint">{formatDate(log.createdAt, lang)}</span>
          <span className="font-semibold">
            {log.user ? `${log.user.displayName} (${log.user.role})` : "—"}
          </span>
          <span className="text-xs text-ink-faint">{log.ipHash ? `IP: ${log.ipHash.slice(0, 12)}…` : ""}</span>
          <details className="ms-auto max-w-full">
            <summary className="cursor-pointer text-xs font-semibold text-primary">
              {t("admin.detail")}
            </summary>
            <pre className="mt-2 max-h-40 max-w-full overflow-auto rounded-xl bg-page p-2 text-xs">
              {JSON.stringify(log.detail, null, 2)}
            </pre>
          </details>
        </li>
      ))}
    </ul>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export function Admin() {
  const { t } = useI18n();
  usePageTitle(t("admin.title"));
  const [tab, setTab] = useState<TabKey>("stats");

  const tabs: { key: TabKey; label: string; emoji: string }[] = [
    { key: "stats", label: t("admin.tabStats"), emoji: "📊" },
    { key: "users", label: t("admin.tabUsers"), emoji: "👥" },
    { key: "games", label: t("admin.tabGames"), emoji: "🎮" },
    { key: "categories", label: t("admin.tabCategories"), emoji: "🗂️" },
    { key: "security", label: t("admin.tabSecurity"), emoji: "🛡️" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("admin.title")}>
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={cn("btn", tab === item.key ? "btn-primary" : "btn-outline")}
          >
            <span aria-hidden="true">{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "stats" && <StatsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "games" && <GamesTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "security" && <SecurityTab />}
    </div>
  );
}

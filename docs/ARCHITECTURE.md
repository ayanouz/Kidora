# KIDORA — Architecture Technique Complète

> Plateforme web de jeux éducatifs, puzzles & arcade pour enfants.
> **Nom provisoire du site : KIDORA** (modifiable en un seul endroit : `frontend/src/config.ts` → `SITE_NAME`).

---

## 1. Analyse du besoin (Étape 1)

**Objectif** : une plateforme réelle, jouable et déployable — pas une maquette.

**Boucle produit principale** : `ARRIVER → CHOISIR → JOUER → GAGNER → PROGRESSER → REJOUER`

**Contraintes structurantes** :
- Enfants 3–13+ : UI ultra-simple, gros boutons, feedback visuel + sonore, zéro popup agressive.
- Privacy-first : minimum de données, pseudonymes uniquement dans les classements, contrôle parental.
- Sécurité : aucun score fiable venant du client (validation serveur + anti-cheat).
- Performance : dépendances minimales, zéro asset image lourd (SVG/emoji/canvas procédural), bundle léger.
- Déploiement : `docker compose up -d` sur Ubuntu, Nginx reverse proxy, Postgres, HTTPS.

---

## 2. Stack technique (Étapes 2 & 3)

| Couche | Technologie | Justification |
|---|---|---|
| Frontend | **React 18 + TypeScript + Vite** | Rapidité, écosystème, DX. |
| Styles | **Tailwind CSS 3** + design tokens CSS | Design system cohérent, bundle CSS minimal. |
| Routing | **React Router v6** | SPA + routes propres (SEO géré via meta dynamiques + sitemap). |
| État global | **Zustand** | Simple, léger (auth, profil, préférences, favoris). |
| Animations | **CSS + Web Animations API** (pas de lib) | §35 : éviter les libs inutiles ; le confetti est un mini-canvas maison. |
| Moteur de jeux | **HTML5 Canvas 2D + TypeScript** (moteur maison) | 62 jeux 2D légers ; pas de Phaser (overkill, budget perf). |
| Audio | **Web Audio API synthétisé** (aucun fichier audio) | Feedback sonore instantané, zéro asset, léger. |
| i18n | Maison (dictionnaires FR/EN/AR + hook `useI18n`) | 3 langues, RTL arabe, zéro dépendance. |
| Backend | **Node 20 + Fastify 4 + TypeScript** (CommonJS) | Rapide, typé, plugins officiels (cookie, cors, helmet, rate-limit). |
| ORM / DB | **Prisma 5 + PostgreSQL 16** | Schéma typé, migrations, seed. |
| Auth | **JWT court (cookie HttpOnly) + refresh token rotatif (hash SHA-256 en DB)** | Session persistante, révocation possible, pas de token en localStorage. |
| Mots de passe | **bcryptjs cost 12** (pur JS → build Docker sans compilateur natif) | Sécurisé + fiable en conteneur alpine. |
| Validation | **Zod** (serveur) + validation client | Entrées strictes, erreurs propres. |
| Logs | **Pino** (intégré Fastify) + table `security_logs` | `info/warn/error/security`, jamais de secrets. |
| Tests | **Vitest** (unit) + **Playwright** (E2E) | Logique pure testable sans DB. |
| Infra | **Docker Compose + Nginx** | 4 services : `postgres`, `backend`, `frontend`, `nginx`. |
| PWA | **Service worker maison + manifest** | Installable, cache assets, offline partiel. |

---

## 3. Arborescence complète du projet (Étape 2)

```text
game kids/
├── frontend/                        # React + TS + Vite
│   ├── public/                      # favicon.svg, manifest.webmanifest, sw.js, robots.txt
│   ├── src/
│   │   ├── assets/                  # illustrations SVG originales (hero, mascotte)
│   │   ├── components/              # Design system + UI réutilisable
│   │   │   ├── ui/                  # Button, Card, Modal, ProgressBar, Avatar, Skeleton, EmptyState, Spinner, Toast
│   │   │   ├── game/                # GameCard, GameGrid, GameThumb, GameHUD, GameTimer, ScoreBoard,
│   │   │   │                        # GameOverModal, LevelSelector, PauseOverlay, Stars, PlayButton
│   │   │   └── layout/              # Navbar, Footer, CategoryCard, LanguageSwitcher, SoundToggle, UserMenu
│   │   ├── config.ts                # SITE_NAME, URLs, constantes
│   │   ├── games/
│   │   │   ├── engine/              # GameEngine réutilisable (voir §7)
│   │   │   ├── registry.ts          # mapping slug → composant React du jeu
│   │   │   ├── MemoryCards/         # GAME 01
│   │   │   ├── Puzzle/              # GAME 02
│   │   │   ├── Maze/                # GAME 03
│   │   │   ├── ColorMatch/          # GAME 04
│   │   │   ├── MathChallenge/       # GAME 05
│   │   │   ├── OddOneOut/           # GAME 06
│   │   │   ├── Pattern/             # GAME 07
│   │   │   ├── BubblePop/           # GAME 08
│   │   │   ├── CatchStars/          # GAME 09
│   │   │   └── MemorySequence/      # GAME 10
│   │   ├── hooks/                   # useAuth, useGames, useFavorites, useLeaderboard, useMediaQuery…
│   │   ├── i18n/                    # index.ts, fr.ts, en.ts, ar.ts
│   │   ├── layouts/                 # MainLayout, GameLayout, AdminLayout, ParentLayout, AuthLayout
│   │   ├── pages/                   # 1 fichier par route (§37)
│   │   ├── services/                # api.ts (client fetch), auth.service.ts, games.service.ts…
│   │   ├── store/                   # auth.store.ts, profile.store.ts, prefs.store.ts, game.store.ts
│   │   ├── styles/                  # globals.css (tokens, base, animations)
│   │   ├── types/                   # types partagés (Game, User, Profile, Score…)
│   │   └── utils/                   # format, random, storage, confetti, seo
│   ├── index.html
│   ├── package.json / tsconfig.json / vite.config.ts / tailwind.config.js / postcss.config.js
│   └── nginx.conf                   # SPA server (conteneur frontend)
│
├── backend/                         # Fastify + Prisma
│   ├── prisma/
│   │   ├── schema.prisma            # §5 Base de données
│   │   ├── seed.ts                  # catégories, jeux, achievements, démo
│   │   └── migrations/
│   ├── src/
│   │   ├── app.ts                   # buildApp() : plugins, routes, error handler
│   │   ├── server.ts                # bootstrap + graceful shutdown
│   │   ├── config/env.ts            # lecture + validation des variables d'env (zod)
│   │   ├── lib/                     # prisma.ts, logger.ts, errors.ts, security.ts (hash, tokens), xp.ts
│   │   ├── plugins/                 # auth.plugin.ts (JWT+cookies), origin-check, rate-limit rules
│   │   ├── middleware/              # requireAuth, requireRole, validate(schema)
│   │   ├── modules/                 # Controller → Service → Repository (1 dossier par domaine)
│   │   │   ├── auth/                # register, login, logout, refresh, forgot/reset password
│   │   │   ├── users/               # moi, settings, RGPD (export/suppression)
│   │   │   ├── profiles/            # profils enfants (CRUD, PIN enfant)
│   │   │   ├── parent/              # dashboard parent, liaison parent_child
│   │   │   ├── games/               # catalogue, détail, filtres
│   │   │   ├── categories/
│   │   │   ├── sessions/            # start/finish session de jeu (anti-cheat)
│   │   │   ├── scores/              # scores + meilleurs scores
│   │   │   ├── progress/            # progression par jeu + compétences
│   │   │   ├── favorites/
│   │   │   ├── achievements/        # définitions + déblocage + évaluation
│   │   │   ├── leaderboard/         # jour/semaine/mois/général (pseudonymes)
│   │   │   ├── admin/               # users, games, categories, stats
│   │   │   └── health/
│   │   ├── services/anticheat/      # score-validator.ts, plausibility.ts, anomaly-logger.ts
│   │   └── tests/                   # unit + integration (app.inject)
│   ├── package.json / tsconfig.json / vitest.config.ts
│   └── Dockerfile
│
├── database/                        # Exploitation DB (le schéma vit dans backend/prisma)
│   ├── backup.sh                    # pg_dump + rotation 7j/4s/6m
│   ├── restore.sh
│   └── README.md                    # procédures backup/restore/cron
│
├── docker/
│   ├── nginx/
│   │   ├── nginx.conf               # reverse proxy prod (§55)
│   │   └── conf.d/kidora.conf
│   └── frontend.Dockerfile          # build Vite → nginx (conteneur frontend)
│
├── e2e/                             # Playwright (§59)
│   └── journeys.spec.ts             # register → login → play → score → profile
│
├── docs/
│   ├── ARCHITECTURE.md              # CE DOCUMENT
│   ├── API.md                       # contrat d'API complet
│   ├── SECURITY.md                  # modèle de menaces + anti-cheat
│   ├── DEPLOYMENT.md                # Ubuntu + Docker + DNS + HTTPS (§61)
│   ├── BACKUP.md                    # stratégie backup (§62)
│   └── MONITORING.md                # health checks, logs, erreurs
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json                     # workspaces : frontend + backend
├── PROGRESS.md                      # état réel d'avancement (reprise entre sessions)
└── README.md
```

---

## 4. Architecture logique (Étape 2)

```text
                    ┌─────────────────┐
                    │      NGINX      │  :80/:443 – HTTPS, gzip, sécurité, SPA, /api proxy
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
        ┌───────▼────────┐       ┌────────▼────────┐
        │    FRONTEND    │       │     BACKEND     │
        │ React/TS/Vite  │──────►│ Fastify/TS      │
        │ (nginx static) │  /api │ Controller→Svc→ │
        └────────────────┘       │ Repository      │
                                 └────────┬────────┘
                                 ┌────────▼────────┐
                                 │   PostgreSQL    │
                                 └─────────────────┘
```

**Backend : architecture en couches** (jamais de logique dans les routes) :
- `routes.ts` (module) → définit URL + validation Zod + appel contrôleur
- `*.controller.ts` → HTTP uniquement (req/res, statuts)
- `*.service.ts` → logique métier (règles, XP, anti-cheat)
- `*.repository.ts` → accès Prisma uniquement

---

## 5. Base de données (Étape 4)

### Tables & relations (Prisma → PostgreSQL)

```text
users               (comptes : parent | child | admin)
  id, email? UNIQUE, password_hash?, role, display_name, avatar,
  birth_year?, age_tier?, xp, level, points, is_active, leaderboard_opt_in,
  consent_accepted_at?, tokens_valid_after (invalidation JWT),
  failed_logins, locked_until?, created_at, updated_at, deleted_at?

profiles            (profils joueurs — un utilisateur a ≥1 profil)
  id, user_id FK→users, display_name, avatar, age_tier,
  xp, level, points, leaderboard_opt_in, pin_hash? (connexion enfant locale),
  is_active, created_at, updated_at
  INDEX (user_id)

parent_child        (un enfant peut avoir plusieurs tuteurs)
  id, parent_id FK→users, profile_id FK→profiles, created_at
  UNIQUE (parent_id, profile_id)

categories
  id, slug UNIQUE, name, emoji, color, sort_order, is_active

games
  id, slug UNIQUE, title, description, category_id FK→categories,
  engine (clé du composant frontend), min_age, max_age?, difficulty,
  emoji, color, config JSON (params de difficulté), max_score_hint,
  is_published, play_count, created_at, updated_at
  INDEX (category_id), INDEX (is_published, play_count)

game_sessions       (anti-cheat : une session = un play validé)
  id, profile_id FK→profiles, game_id FK→games, difficulty,
  status (active|finished|abandoned), started_at, finished_at?,
  score?, duration_ms?, is_win?, level_reached?, client_meta JSON?,
  ip_hash?, anomaly_flags? JSON
  INDEX (profile_id, started_at), INDEX (game_id, status)

scores              (historique des scores VALIDÉS)
  id, profile_id FK, game_id FK, session_id FK UNIQUE?,
  score, duration_ms, is_win, difficulty, created_at
  INDEX (game_id, score DESC), INDEX (profile_id, game_id)

progress            (agrégat par profil × jeu)
  id, profile_id FK, game_id FK, level, best_score, plays, wins,
  total_time_ms, last_played_at, UNIQUE (profile_id, game_id)
  INDEX (profile_id)

achievements
  id, code UNIQUE, title, description, icon, category, xp_reward, criteria JSON

user_achievements
  id, profile_id FK, achievement_id FK, unlocked_at
  UNIQUE (profile_id, achievement_id)

favorites
  id, profile_id FK, game_id FK, created_at, UNIQUE (profile_id, game_id)

refresh_tokens      (rotation + révocation)
  id, user_id FK, token_hash UNIQUE (SHA-256), user_agent?, ip_hash?,
  expires_at, revoked_at?, created_at
  INDEX (user_id)

security_logs       (anomalies, brute-force, événements sensibles)
  id, type, user_id?, ip_hash?, detail JSON, created_at
  INDEX (type, created_at)
```

### Règles clés
- Suppression = **soft delete** (`deleted_at`) + purge RGPD réelle sur demande.
- Tous les identifiants sont des **CUID** (non énumérables → anti-IDOR).
- Les scores ne sont **jamais** écrits par le client : uniquement par `sessions/finish` validé.
- Pseudo du leaderboard = `display_name` (jamais email, jamais nom réel).

---

## 6. API Backend (Étape 5)

Base : `/api` · JSON strict · cookies HttpOnly · erreurs normalisées `{ error: { code, message } }`.

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | – | Créer un compte parent (+ profil par défaut) |
| POST | `/api/auth/login` | – | Connexion (rate-limité, verrouillage progressif) |
| POST | `/api/auth/logout` | ✔ | Révocation refresh token + cookies |
| POST | `/api/auth/refresh` | cookie | Rotation du refresh token |
| POST | `/api/auth/forgot-password` | – | Envoi lien (réponse générique anti-énumération) |
| POST | `/api/auth/reset-password` | – | Reset via token à usage unique |
| GET | `/api/auth/me` | ✔ | Utilisateur + profils |
| GET | `/api/games` | – | Catalogue (search, category, age, difficulty, sort, pagination) |
| GET | `/api/games/:slug` | – | Détail jeu + stats perso si connecté |
| GET | `/api/categories` | – | Catégories + nombre de jeux |
| GET | `/api/profiles` | ✔ | Profils de l'utilisateur |
| POST | `/api/profiles` | ✔ parent | Créer un profil enfant |
| PUT | `/api/profiles/:id` | ✔ | Modifier (avatar, âge, pseudo) |
| DELETE | `/api/profiles/:id` | ✔ parent | Supprimer un profil |
| POST | `/api/profiles/:id/select` | ✔ | Définir le profil actif |
| GET | `/api/progress` | ✔ | Progression agrégée + par compétence |
| GET | `/api/scores` | ✔ | Scores du profil actif |
| POST | `/api/sessions/start` | ✔ | Démarrer une session de jeu (serveur : startedAt) |
| POST | `/api/sessions/:id/finish` | ✔ | Terminer : validation anti-cheat + score + XP + achievements |
| GET | `/api/favorites` | ✔ | Favoris |
| POST | `/api/favorites/:gameId` | ✔ | Ajouter favori |
| DELETE | `/api/favorites/:gameId` | ✔ | Retirer favori |
| GET | `/api/achievements` | ✔ | Définitions + débloqués |
| GET | `/api/leaderboard?period=day\|week\|month\|all` | – | Pseudonymes uniquement |
| GET | `/api/parent/children` | ✔ parent | Enfants + stats résumées |
| GET | `/api/parent/dashboard/:profileId` | ✔ parent | Compétences, activité, temps de jeu |
| GET | `/api/admin/stats` | ✔ admin | KPIs dashboard |
| GET | `/api/admin/users` | ✔ admin | Liste + recherche + filtres |
| PATCH | `/api/admin/users/:id` | ✔ admin | Activer/désactiver |
| DELETE | `/api/admin/users/:id` | ✔ admin | Supprimer (soft) |
| CRUD | `/api/admin/games` | ✔ admin | Créer/modifier/publier/supprimer |
| CRUD | `/api/admin/categories` | ✔ admin | CRUD complet |
| GET | `/api/health` | – | `{ status, database }` |
| GET | `/api/sitemap.xml` | – | Sitemap dynamique (jeux publiés) |

---

## 7. Game Engine (Étape 9 — socle)

```text
games/engine/
 ├── types.ts             # GameDefinition, GameResult, Difficulty, GameCallbacks
 ├── useGameEngine.ts     # machine à états : idle → playing → paused → over
 ├── useCountdown.ts      # timer fiable (performance.now, deltas)
 ├── useInterval.ts       # boucle de jeu (requestAnimationFrame wrapper)
 ├── ScoreManager.ts      # score, combo, multiplicateur, meilleur score local
 ├── DifficultyManager.ts # adaptatif : réussite facile → +1 ; échecs répétés → aide/-1
 ├── LevelManager.ts      # niveaux, paliers, nextLevel()
 ├── SoundManager.ts      # WebAudio synthétisé : click, correct, wrong, win, level, achievement, bonus
 ├── InputManager.ts      # clavier (flèches/WASD/Entrée) + tactile (D-pad, swipe, tap)
 ├── GameStorage.ts       # localStorage : reprise (niveau/score), préférences
 ├── achievements.ts      # signaux de déblocage émis par les jeux
 └── components/          # GameHUD, GameTimer, ScoreBoard, GameOverModal, LevelSelector, PauseOverlay, Stars
```

Contrat commun (implémenté par chaque jeu) :

```typescript
interface GameDefinition {
  id: string;            // slug stable
  title: string;
  category: string;
  minAge: number;
  maxAge?: number;
  difficulties: Difficulty[];      // facile | moyen | difficile
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  finish(result: GameResult): void;
}
```

Chaque jeu React expose : **démarrage, pause, victoire, défaite (si pertinent), restart, score, timer, niveaux, responsive, clavier + tactile** (§65).

---

## 8. Gamification — formules serveur (Étape 11)

- **XP d'une partie** = `round(score/10) + (is_win ? 50 : 10) + bonus_difficulté(0|25|50) + bonus_temps(≤30)`, plafonné par partie.
- **Niveau utilisateur** = `floor(sqrt(xp / 100)) + 1` → progression douce, jamais bloquante.
- **Points** = cumul brut des scores validés (classement).
- **Étoiles par partie** : ⭐ score ≥ 40 % du max · ⭐⭐ ≥ 70 % · ⭐⭐⭐ ≥ 90 %.
- **Achievements** évalués **côté serveur** après chaque session validée (codes : `first_game`, `games_5`, `games_10`, `points_1000`, `streak_5`, `memory_master`, `logic_master`, `speedster`, `puzzle_master`, `perfectionist`, …).
- **Difficulté adaptative** : gérée côté jeu (front) via `DifficultyManager` ; signalée au serveur (`client_meta`).

---

## 9. Design System (Étape 6)

### Palette (tokens CSS `--k-*`)
| Token | Valeur | Usage |
|---|---|---|
| `primary` | `#6C5CE7` (violet) | Actions principales |
| `primary-dark` | `#5546C8` | Hover |
| `secondary` | `#00B8A9` (turquoise) | Accents |
| `accent` | `#FFB020` (soleil) | Récompenses, étoiles |
| `success` | `#22B573` | Bonne réponse |
| `danger` | `#FF5A5F` | Erreur (jamais humiliant) |
| `warning` | `#FF8A3D` | Attention |
| `bg` | `#F7F6FF` | Fond global |
| `surface` | `#FFFFFF` | Cartes |
| `ink` | `#2D2A45` | Texte principal |
| `ink-soft` | `#6B6880` | Texte secondaire |

Couleurs catégories : puzzles `#6C5CE7`, intelligence `#8E44AD`, maths `#0984E3`, mémoire `#E84393`, arcade `#FF5A5F`, observation `#00B8A9`, labyrinthes `#F39C12`, créativité `#E67E22`, rapidité `#D63031`, populaires `#FFB020`.

### Typographie
- Famille : **Fredoka** (arrondie, très lisible enfant) + fallback system-ui.
- Échelle : `h1 2.5rem/800`, `h2 1.8rem/700`, `body 1.05rem/500`, `button 1.1rem/700`, jamais < `0.85rem`.
- Interlignage généreux, contrastes ≥ 4.5:1.

### Composants
- **Boutons** : `Primary`, `Secondary`, `Success`, `Danger`, `Ghost` — hauteur min 48px (56px pour enfants 3–5), radius `1rem`, focus visible 3px.
- **Cartes** : radius `1.25rem`, ombre douce `0 6px 24px rgba(108,92,231,.12)`, hover `translateY(-4px)`.
- **Grilles** : catalogue `repeat(auto-fill, minmax(240px, 1fr))` ; jeux canvas fluides `aspect-ratio`.
- **Feedback** : vert + rebond + son = correct ; orange doux + shake léger « Presque ! Essaie encore 😊 » = erreur.
- **Accessibilité** : focus clavier visible, `aria-label` partout, `prefers-reduced-motion` respecté, son coupable via bouton 🔊/🔇, jamais d'info uniquement par la couleur.

### Responsive
Breakpoints testés : `320 / 375 / 390 / 768 / 1024 / 1280 / 1440 / 1920`. Jeux canvas : redimensionnement `ResizeObserver` + DPR.

### i18n (Étape 16 doc)
`fr` (défaut), `en`, `ar` (RTL via `dir="rtl"`). Toutes les chaînes dans `frontend/src/i18n/{fr,en,ar}.ts`, accès via `t("games.play")`. Aucun texte en dur dans les composants.

---

## 10. Sécurité & Anti-cheat (Étapes 10/13 — détail dans `docs/SECURITY.md`)

1. Mots de passe : bcrypt cost 12, jamais loggés, jamais renvoyés.
2. Sessions : access JWT 15 min (cookie HttpOnly + SameSite=Lax + Secure en prod) ; refresh 30 j rotatif, hash SHA-256 en DB, révocation en cascade + `tokens_valid_after`.
3. CSRF : SameSite + vérification `Origin` sur toute mutation + API JSON-only.
4. Rate limiting : global + renforcé sur `/auth/*` (10/min) ; verrouillage compte progressif après échecs.
5. Anti-énumération : messages génériques login/forgot-password, timing constant.
6. Validation Zod systématique + **pas de mass assignment** (DTO explicites).
7. IDOR : CUID + vérification systématique de propriété (profil ↔ utilisateur).
8. Scores : **jamais** acceptés du client — calculés/validés serveur via sessions (`start` → `finish`) :
   - durée minimale plausible par jeu/difficulté ;
   - score ≤ plafond plausible (config par jeu) ;
   - une session ne peut être terminée qu'une fois ;
   - nombre de sessions/heure limité par profil ;
   - anomalies → `security_logs` + score marqué suspect (rejeté).
9. Headers : `@fastify/helmet` + réponse Nginx (CSP, HSTS, X-Content-Type-Options, Referrer-Policy…).
10. Erreurs : jamais de stack trace au client en prod.

---

## 11. Roadmap de développement (Étapes 7→17)

- [x] Étape 1–6 : Analyse, architecture, stack, DB, API, design system (ce document)
- [ ] Racine projet : workspaces, `.env.example`, docker-compose, nginx, docs infra
- [ ] Backend : socle (app, plugins, erreurs, logger) + Prisma schema + seed
- [ ] Backend : modules auth / users / profiles / games / categories
- [ ] Backend : sessions + anti-cheat + scores + progress + achievements + leaderboard + favorites
- [ ] Backend : admin + parent + health + tests vitest
- [ ] Frontend : socle Vite/Tailwind, design system, i18n, layouts, stores, services
- [ ] Frontend : pages catalogue/profil/auth/favoris/classement/parent/admin + toutes pages statiques
- [ ] Game Engine complet
- [ ] Jeux 01→10 (chacun : logique, états, niveaux, score, victoire, restart, responsive, clavier + tactile)
- [ ] Gamification UI (XP, étoiles, badges, Game Over élégant, feedback positif)
- [ ] Tests unit + intégration + E2E Playwright
- [ ] PWA + SEO (sitemap, robots, OG) + perf (lazy, code splitting)
- [ ] Docker + Nginx + documentation finale (README, DEPLOYMENT, BACKUP, MONITORING)

> **Reprise entre sessions** : voir `PROGRESS.md` (état réel) — toujours à jour.

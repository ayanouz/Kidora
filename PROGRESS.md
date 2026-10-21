# ══════════════════════════════════════════════════════════════════
#  KIDORA — ÉTAT D'AVANCEMENT (reprise entre sessions)
#  Dernière mise à jour : session 4 — 62 jeux + abonnements Premium (21/10/2026)
#
#  ➜ Pour reprendre le travail : lire ce fichier, puis la première
#    tâche non cochée de « RESTE À FAIRE ».
#  ➜ Plan complet : docs/ARCHITECTURE.md
#  ➜ Contrat des jeux : docs/GAMES-CONTRACT.md
# ══════════════════════════════════════════════════════════════════

## ✅ FAIT (projet complet — 100 % des livrables écrits)

### Racine & déploiement
- [x] `docs/ARCHITECTURE.md` (analyse, stack, DB, API, design system, roadmap)
- [x] `package.json` (workspaces + scripts dev/build/test/e2e), `.env.example`, `.gitignore`
- [x] `docker-compose.yml` (postgres + backend + frontend + nginx), `docker/nginx/nginx.conf`
      (proxy, sitemap → API, rate limit, CSP/HSTS), `frontend/nginx.conf` (SPA)

### Backend (Fastify 4 + Prisma 5 + PostgreSQL 16)
- [x] `prisma/schema.prisma` + `prisma/seed.ts`
      (9 catégories, **62 jeux** dont 19 Premium avec configs anti-triche,
      15 badges, 3 formules Premium, comptes de démo)
- [x] Socle : `config/env`, `lib/*` (erreurs, logger, Prisma, durée, sérialiseurs,
      xp), `app.ts`, `server.ts`, plugins `auth` (cookies JWT + refresh rotatif
      haché SHA-256) et `security` (origine, security_logs)
- [x] Modules : health (+ sitemap dynamique), auth, users (export/suppression
      RGPD), profiles, games, categories, sessions (start/finish/abandon/resume),
      scores, progress, favorites, achievements, leaderboard, parent, admin,
      **billing** (plans, abonnement, Stripe Checkout + mode démo)
- [x] Anti-triche : `services/anticheat/score-validator.ts` (durée réelle,
      minDurationMs, plafonds, niveaux, quota horaire) + `services/gamification`
      (étoiles 40/70/90 %, XP, niveaux, badges)
- [x] Tests unitaires backend (xp, anti-triche, validation, durée)

### Frontend (React 18 + TS + Vite + Tailwind + Zustand)
- [x] Configs Vite/Tailwind/TS, `index.html` (SEO + OG + PWA + Fredoka),
      `globals.css`, `public/` (manifest, sw.js, robots.txt, icon.svg)
- [x] Types DTO, services API (cookies + refresh auto + download RGPD),
      stores (auth, prefs, filtres), hooks (useAsync, usePageTitle…)
- [x] i18n fr (référence) / en / ar (RTL) — sections `hud`, `legal`, `admin`
- [x] Design system : Button, Modal, Display (Avatar/Stars/ProgressBar), Feedback
      (Spinner/Empty/Error/Skeleton), Confetti
- [x] Composants jeu : GameCard, GameGrid, GameFilters, GameThumb, FavoriteButton
- [x] Layouts : Main, Game, Auth, Parent, Admin + guards (Protected/Parent/Admin)
- [x] **Game Engine** : types, hooks (useSound/useCountdown/useGameSession/
      useCanvas), SoundManager (WebAudio), GameStorage, difficulty (adaptatif),
      components (GameHUD, ScoreBoard, ReadyScreen, PauseOverlay…),
      GameOverModal, GameShell (session serveur, pause, streak, quit confirm)
- [x] **62 jeux complets** (`games/registry.ts`) :
      23 quiz (`quiz`), 13 arcade (`arcade`), puzzles et plateau (Morpion,
      Puissance 4, Sudoku, Démineur, Hanoï, Pixel Puzzle, Mots mêlés, Puzzle
      échange…), mémoire, maths, observation, rapidité
      — tous : clamp ≤ 95 % du plafond, `finish` unique, boucles/entrées
      gelées en pause, i18n/emojis/canvas, timers nettoyés, verrous
      synchrones anti double-clic
- [x] **Toutes les pages** : Home, Games (filtres+URL), GameDetail (shell inline
      + paywall Premium), Categories, Category, Login, Register, ForgotPassword,
      ResetPassword, Settings, Profile, Favorites, Leaderboard, Achievements,
      Parent, ParentChild, **Premium** (offres, abonnement, paiements),
      Admin (5 onglets), About, Contact, Help, Privacy, Terms, Cookies,
      NotFound
- [x] `App.tsx` (routeur complet) + `main.tsx` (SW en prod)
- [x] Tests frontend : `src/tests/setup.ts` + Button, difficulty (streak/étoiles),
      GameStorage, utilitaires moteur (formatMs, maxScoreFor)

### Tests E2E & docs & scripts
- [x] `playwright.config.ts` (desktop + mobile) + `e2e/journeys.spec.ts`
      (7 parcours : invité, partie/pause/quitter, 404, parent, classement, admin)
      + `e2e/README.md`
- [x] `docs/` : API.md, SECURITY.md, DEPLOYMENT.md, BACKUP.md, MONITORING.md,
      GAMES-CONTRACT.md, ARCHITECTURE.md
- [x] `database/` : backup.sh (docker/local, purge), restore.sh (confirmation,
      vérification tables), README.md
- [x] `README.md` racine (features, structure, démarrage, comptes démo, docs)

## ✅ SESSION 4 — 62 JEUX + ABONNEMENTS PREMIUM (21/10/2026)

### Ajouts
- [x] **Billing** : modèles `Plan`, `Subscription`, `Payment` + `Game.premium`
      (migration `20261021140324_add_premium_billing`), 3 formules
      (mensuel 6,99 €, annuel 49,90 €, Famille+ 79,90 €), essai 7 jours.
- [x] **Service billing** : Stripe Checkout par REST si configuré ; sinon
      **mode démo** (hors production) : activation immédiate, paiement 0 €,
      vérification serveur, annulation en fin de période + reprise,
      expiration paresseuse, admins exemptés.
- [x] **Paywall** : `startSession` renvoie 402 `PREMIUM_REQUIRED` ; le DTO jeu
      expose `premium` ; GameDetail affiche l'écran verrouillé et la page
      `/premium` gère l'achat, le statut et l'historique des paiements.
- [x] **19 jeux Premium** (8 quiz, 5 arcade, 6 puzzles/plateau) et
      **62 jeux** seedés au total ; catégories et traductions FR/EN/AR mises à
      jour (dont RTL).
- [x] Corrections de robustesse sur les jeux autonomes : verrous synchrones
      anti double-clic (Memory des nombres, Chasse aux nombres, Hanoï, Puzzle
      échange, Sudoku, Pixel Puzzle, Mots mêlés…), pannes de score au fil des
      niveaux (Défi maths, Bubble Pop, Attrape les étoiles), transitions
      pause/reprise, cibles téléportées.
- [x] Corrections de contenu/localisation : coquille du Mots mêlés, libellé
      « Difficulté » manquant dans les stats de jeu.

### Vérifié
- [x] `typecheck`, `npm test` (65/65) et `npm run build` : OK.
- [x] `npm run test:e2e` : **14/14** (desktop + mobile).
- [x] Smoke des **62 jeux** : page → « C'EST PARTI ! » → moteur monté et session
      serveur démarrée, en FR, premium débloqué pour un compte abonné.
- [x] Premium en local : compte gratuit → paywall 👑 + 402 côté API ;
      activation démo → accès immédiat ; annulation → « accès conservé
      jusqu'au… » ; reprise → abonnement actif ; paiement « Essai gratuit »
      visible ; parent seedé (annuel) et admin (bypass) vérifiés.
- [x] `parent@kidora.dev` : Premium actif (annuel) ; `pixelkid@kidora.dev`
      remis en compte gratuit après les tests (paywall de démo).

### À suivre (déploiement réel uniquement)
- [ ] `docker compose up -d --build` + checklist `docs/DEPLOYMENT.md` §6
      (Docker absent de la machine de dev).
- [ ] Brancher Stripe en production : renseigner `STRIPE_SECRET_KEY`,
      `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_FAMILY`,
      ajouter le webhook `checkout.session.completed` (le retour d'écran
      `POST /api/billing/confirm` suffit en attendant, mais un webhook rend
      l'activation fiable même si l'onglet est fermé).
- [ ] Personnaliser : nom définitif (`SITE_NAME`), domaine, emails légaux.

## 📋 RESTE À FAIRE (vérifications finales — aucune écriture de code requise)

1. [x] **Compiler & lancer pour la 1re fois** — fait le 17/10/2026 (Node 24 +
       PostgreSQL 16 portables installés) : `npm run typecheck` OK après
       corrections (voir §Vérifications ci-dessous).
2. [x] `npm run migrate -- --name init && npm run seed` puis `npm run dev` :
       parcours validé en réel (API : login admin/parent/enfant, stats, session
       start → finish acceptée, triche rejetée 422) et via les E2E.
       → **Committer `backend/prisma/migrations/20261017224313_init`**
       (créé lors de ce run) pour activer `migrate deploy` en production.
3. [x] `npm run test` : 65/65 (backend 31 + frontend 34) ·
       `npm run test:e2e` : 14/14 (desktop + mobile, Chromium).
4. [ ] `docker compose up -d --build` + checklist `docs/DEPLOYMENT.md` §6.
       Docker n'est pas installé sur la machine de dev : compose a été corrigé
       et relu, mais **pas exécuté** — à vérifier sur la machine cible.
5. [ ] Personnaliser : nom définitif (`SITE_NAME` dans `frontend/src/config.ts`),
       domaine dans `.env`/nginx, emails de contact légaux.
6. [ ] Envisager : vrai certificat TLS (docs/DEPLOYMENT.md §4.2), cron de
       sauvegarde (docs/BACKUP.md §3), supervision externe (docs/MONITORING.md).

## ✅ VÉRIFICATIONS DU 17/10/2026 (première exécution réelle)

- Outils installés **sans droits admin** : Node 24 LTS + PostgreSQL 16.4
  portables dans `%LOCALAPPDATA%\kidora-tools` ; base `kidora` migrée +
  seedée ; migration initiale générée :
  `backend/prisma/migrations/20261017224313_init`.
- `npm run typecheck` : OK (backend + frontend).
- `npm run test` : 65/65 (backend 31, frontend 34).
- `npm run test:e2e` : 14/14 (desktop + mobile, Chromium installé).
- `npm run build` : OK (backend `tsc` + Vite).
- API vérifiée en réel : health (DB connected), login admin/parent/enfant,
  stats admin, classement, session start → finish légitime (XP + badges
  attribués), tentative de triche instantanée rejetée **422**.
- Scripts de lancement local : `start-kidora.ps1` / `stop-kidora.ps1`
  (voir README « Sur ce PC Windows »).
- Corrections appliquées lors de ce premier run :
  1. Chargement du `.env` racine côté backend — `src/load-env.ts` (déjà décrit
     ci-dessous) ; `dotenv-cli` pour le CLI Prisma ; `tsx` + `src/` dans
     l'image Docker ; compose `migrate deploy`/`db push` + `COOKIE_SECURE`.
  2. 3 imports backend corrigés (`../../` → `../` : auth.plugin,
     security.plugin, achievements-evaluator).
  3. `middleware/validate.ts` : génériques `z.output<S>` — les schémas avec
     `.default()`/`.transform()` sont correctement typés (8 erreurs TS).
  4. `i18n/index.ts` → **`.tsx`** (contenait du JSX).
  5. `Dictionary` : valeurs élargies à `string` (`DeepWiden`) — en/ar ne sont
     plus forcés de contenir le texte français exact.
  6. `useCanvas` : `RefObject<HTMLCanvasElement>` (typage React 18).
  7. Tests XP/achievements alignés sur les règles réelles : bonus rapidité
     60 s = 18 XP (max atteignable 530, plafond 600), `perfect_score` =
     3 étoiles **en difficulté hard**.
  8. Affichage `winRate` corrigé (Admin + Profil : ×100 en trop → 10 000 %).
  9. E2E : onglets admin ciblés par rôle ARIA `tab` ; sélecteurs Parent
     pointant le contenu principal (doublons cachés du menu mobile).

## ⚠️ NOTES DE SESSION (importantes)

- Machine de dev Windows : à l'origine **sans Node/npm/git/Docker** ; désormais
  équipée d'outils portables (`%LOCALAPPDATA%\kidora-tools`) — voir
  §Vérifications ci-dessus. Docker reste absent : le chemin compose n'est pas
  testé sur cette machine.
- Corrections « premier run » : le backend charge le `.env` racine via
  `src/load-env.ts` (importé en 1er par `server.ts` et `prisma/seed.ts`) ;
  `npm run migrate` passe par `dotenv-cli` (`dotenv -e ../.env`) ; `tsx` est
  passé en dépendance de production et `src/` est copié dans l'image Docker
  (pour `npm run seed` dans le conteneur) ; docker-compose fait
  `migrate deploy` si `backend/prisma/migrations/` existe, sinon `db push` ;
  `COOKIE_SECURE` du compose suit le `.env` (false en test local http).
- Décisions structurantes (à ne pas « corriger » par erreur) :
  • Le client **n'écrit jamais** de score : sessions serveur start → finish.
  • Cumul des points d'un jeu plafonné à `floor(cap × 0.95)` (règle
    `docs/GAMES-CONTRACT.md` §3) — une partie parfaite passe l'anti-triche
    et atteint 3 étoiles (seuil 90 %).
  • `GameShell` remonte le jeu à chaque run (`key={runId}`) : le **montage =
    début de partie** ; `ctx.running` gèle les boucles ; `finish()` unique.
  • Pause : Échap ou onglet caché ; sortie en partie = confirmation douce
    (bouton « Retour » du HUD pendant playing **et** paused).
  • Sessions invitées : jeu local (GameStorage), aucun XP serveur.
  • `SCORE_REJECTED` (422) → message doux « score non validé » ; réseau →
    « hors-ligne, score gardé sur l'appareil ».
  • Cookies : `kidora_at` (path /, 15 min) + `kidora_rt` (path /api/auth,
    30 j, rotatif, haché SHA-256 en base).
  • Réponses API d'erreur : `{ error: { code, message, details? } }`.
  • `winRate` API parents = **pourcentage 0–100** (pas une fraction).
  • Aucun asset binaire : emojis, SVG inline, canvas procédural, sons WebAudio.
- Comptes de démo (après seed) : admin@kidora.dev / Admin1234!,
  parent@kidora.dev / Parent1234! (enfants Adam, Lina),
  pixelkid@kidora.dev / Demo1234!.
- Nom provisoire : **KIDORA** (`SITE_NAME`, textes dans `frontend/index.html`).

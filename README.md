# KIDORA 🎮

**Des jeux éducatifs, des puzzles et de l'arcade pour les enfants de 3 à 13 ans
et plus.** Sans publicité, sans traqueurs, avec un espace parents pour suivre la
progression — et 62 jeux réellement jouables dès la première visite.

> Nom provisoire : **KIDORA** — modifiable via `SITE_NAME` dans
> `frontend/src/config.ts` (et les textes SEO dans `frontend/index.html`).

---

## ✨ Fonctionnalités

### Pour les enfants (et les curieux)
- **62 jeux complets** répartis en familles : quiz et culture (23), arcade (13),
  puzzles et plateau (Puissance 4, Morpion, Sudoku, Démineur, Hanoï, Mots mêlés,
  Pixel Puzzle…), mémoire, maths, observation, rapidité. Parmi eux, **19 jeux
  Premium** (couronne 👑 dans le catalogue) et 43 jeux gratuits.
- **Contrôles pensés pour tous** : souris, tactile (tap, glisser-déposer,
  balayage), clavier (flèches, WASD, 1–4, Échap pour la pause).
- **Feedback bienveillant** : jamais de gros « PERDU », sons doux synthétisés
  (WebAudio, zéro fichier audio), confettis, animations respectant
  `prefers-reduced-motion`.
- **Difficulté adaptative** : facile / moyen / difficile, suggestion automatique
  après 2 victoires ou 2 défaites, niveaux progressifs.
- **Gratuit sans compte** : les invités jouent tout de suite (scores conservés
  sur l'appareil) ; le compte (créé par un parent) sauvegarde la progression.

### Pour les parents
- **Espace parents** : temps de jeu (jour/semaine/mois/total), taux de réussite,
  progression par compétence, activité par jeu, sessions récentes, badges.
- **Profils enfants** multiples, chacun avec son avatar emoji et ses stats.
- **Premium (optionnel)** : 19 jeux exclusifs, formules mensuelle / annuelle /
  Famille+, 7 jours d'essai, annulation et reprise en un clic, historique des
  paiements. Paiement Stripe en production ; **mode démo** local sans paiement
  réel quand Stripe n'est pas configuré.
- **Confidentialité d'abord** : pseudos uniquement, classement en **opt-in**,
  export et suppression des données (RGPD) en un clic depuis les paramètres.
- **Aucune publicité, aucun traqueur, aucune revente de données.**

### Technique
- **Anti-triche côté serveur** : le client ne peut jamais écrire un score direct
  (sessions `start → finish` validées : durée réelle, plafonds, niveaux).
- **Auth solide** : JWT 15 min + refresh rotatif opaque, cookies HttpOnly,
  bcrypt, rate limiting, vérification d'origine.
- **i18n FR / EN / AR** (arabe en RTL), thème clair, responsive 320 → 1920 px,
  PWA installable, HTML sémantique + ARIA (boutons ≥ 48 px).
- **Gamification** : XP, niveaux, points, étoiles (40/70/90 %), 15 badges,
  classement par période (jour/semaine/mois/général).
- **Admin** : statistiques, utilisateurs, jeux, catégories, journal de sécurité.
- **Abonnements** : plans en base, abonnement unique par compte, vérification
  serveur du Premium à chaque démarrage de partie (les admins sont exemptés),
  Stripe Checkout en production, activation démo en développement.
- **Zéro asset binaire** : emojis, SVG inline, canvas procédural et sons
  synthétisés — le dépôt reste léger et lisible.

---

## 🗂️ Structure

```
kidora/
├── backend/                 # Fastify + TypeScript + Prisma + PostgreSQL
│   ├── prisma/              # schema + seed (62 jeux, 15 badges, plans, comptes démo)
│   └── src/
│       ├── modules/         # auth, users, profiles, games, sessions, scores,
│       │                    # progress, favorites, achievements, leaderboard,
│       │                    # parent, admin, billing, health
│       ├── plugins/         # auth (cookies/JWT), security (origin, logs)
│       ├── services/        # anti-cheat, gamification (XP/badges/niveaux)
│       └── lib/             # env, erreurs, logger, Prisma, durée, sérialiseurs
├── frontend/                # React 18 + TypeScript + Vite + Tailwind + Zustand
│   ├── public/              # manifest PWA, service worker, robots.txt, icône
│   └── src/
│       ├── games/           # engine/ (shell, HUD, stockage, sons) + 62 jeux
│       ├── pages/           # accueil, catalogue, jeu, auth, profil, parents,
│       │                    # classement, badges, favoris, admin, pages légales
│       ├── components/      # design system, cartes de jeu, gardes de routes
│       ├── layouts/         # principal, jeu, auth, parents, admin
│       ├── services/        # client API (cookies, refresh auto), services métier
│       ├── store/           # Zustand : auth, préférences, filtres
│       └── i18n/            # fr (référence), en, ar (RTL)
├── database/                # backup.sh, restore.sh, backups/
├── docs/                    # ARCHITECTURE, API, SECURITY, DEPLOYMENT,
│                            # BACKUP, MONITORING, GAMES-CONTRACT
├── e2e/                     # parcours Playwright
└── docker/                  # Nginx reverse proxy (+ certs, www)
```

---

## 🚀 Démarrage rapide

### Sur ce PC Windows (installation portable déjà en place)

Node 24 LTS et PostgreSQL 16 sont installés **sans droits admin** dans
`%LOCALAPPDATA%\kidora-tools`, la base `kidora` est migrée + seedée, et les
dépendances npm sont installées.

```powershell
# Démarrer PostgreSQL + l'application (API :4000, web :5173)
powershell -ExecutionPolicy Bypass -File .\start-kidora.ps1

# Arrêter PostgreSQL
powershell -ExecutionPolicy Bypass -File .\stop-kidora.ps1
```

→ **http://localhost:5173** (comptes de démo plus bas).

> **Windows** : `npm.ps1` est bloqué par la stratégie d'exécution → utiliser
> `npm.cmd`. Un `npm run build` pendant que `npm run dev` tourne peut échouer
> (EPERM : DLL Prisma verrouillée) : arrêter le dev d'abord.

### Avec Docker (recommandé pour « voir » le résultat)

```bash
cp .env.example .env      # PowerShell : Copy-Item .env.example .env
# puis renseigner POSTGRES_PASSWORD, JWT_SECRET, SESSION_SECRET (openssl rand -base64 48)
docker compose up -d --build   # schéma DB synchronisé automatiquement au démarrage
docker compose exec backend npm run seed
# → http://localhost
```

> **Premier run** : tant qu'aucune migration n'est versionnée dans
> `backend/prisma/migrations/`, le backend synchronise le schéma avec
> `prisma db push`. Pour passer au mode migrations, exécuter une fois sur une
> machine avec Node ≥ 20 : `npm install && npm run migrate -- --name init`,
> puis committer `backend/prisma/migrations/` (les runs suivants utiliseront
> `migrate deploy`).

### En développement (Node ≥ 20 + PostgreSQL ≥ 16)

```bash
cp .env.example .env      # renseigner DATABASE_URL (localhost) + secrets
npm install
createdb kidora
npm run migrate -- --name init   # 1re fois : crée la migration initiale
npm run seed              # jeux, badges, comptes de démo
npm run dev               # API :4000 + web :5173
```

### Comptes de démonstration (après seed)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@kidora.dev` | `Admin1234!` |
| Parent (enfants Adam & Lina) | `parent@kidora.dev` | `Parent1234!` |
| Enfant autonome | `pixelkid@kidora.dev` | `Demo1234!` |

> **Tester le Premium en local** : `pixelkid@kidora.dev` est volontairement sans
> abonnement (paywall visible sur les jeux 👑) ; `parent@kidora.dev` a un
> abonnement annuel actif. Sur la page **Premium**, le bouton d'activation
> fonctionne en **mode démo** tant que `STRIPE_SECRET_KEY` n'est pas renseignée
> hors production : aucun paiement réel, abonnement activé immédiatement.
> Pour brancher Stripe : renseigner `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`,
> `STRIPE_PRICE_YEARLY` et `STRIPE_PRICE_FAMILY` (voir `.env.example`).

---

## 🧪 Tests

```bash
npm run test              # unitaires + intégration (backend + frontend)
npm run test:e2e          # Playwright (app + base seedées requises)
npm run typecheck         # TypeScript strict partout
```

- **Backend** : logique pure (XP, étoiles, niveaux, anti-triche, durée) +
  tests d'intégration (auth 401/403/429, validation Zod).
- **Frontend** : Vitest + Testing Library (design system, stockage local,
  difficulté adaptative, utilitaires du moteur).
- **E2E** : parcours invité (catalogue → partie → pause → quitter), connexion
  parent, espace parents, classement, administration.
- **Vérification manuelle** : les 62 jeux démarrent (session serveur + montage du
  moteur) et le paywall Premium est appliqué côté serveur
  (402 `PREMIUM_REQUIRED` pour un compte gratuit).

---

## ⚙️ Scripts utiles

| Commande | Effet |
|---|---|
| `npm run dev` | Backend + frontend en parallèle |
| `npm run build` | Build production (backend TS + frontend Vite) |
| `npm run migrate` / `npm run seed` | Base de données |
| `npm run test` / `npm run test:e2e` | Tests |
| `./database/backup.sh` | Sauvegarde PostgreSQL |
| `./database/restore.sh <fichier>` | Restauration |

---

## 📚 Documentation

| Document | Contenu |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Analyse, stack, schéma de base, API, design system, roadmap |
| [`docs/API.md`](docs/API.md) | Tous les endpoints, erreurs, anti-triche, config des jeux |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Menaces, auth, cookies, RGPD, réponse à incident |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker, HTTPS, mises à jour, rollback, dépannage |
| [`docs/BACKUP.md`](docs/BACKUP.md) | Stratégie de sauvegarde, restauration, exercices |
| [`docs/MONITORING.md`](docs/MONITORING.md) | Santé, logs, indicateurs, alertes, maintenance |
| [`docs/GAMES-CONTRACT.md`](docs/GAMES-CONTRACT.md) | Contrat que respecte chaque jeu (et comment en ajouter un) |
| [`PROGRESS.md`](PROGRESS.md) | Journal d'avancement et notes de session |

---

## 👋 Contribuer / ajouter un jeu

1. Lire `docs/GAMES-CONTRACT.md` (cycle de vie, scoring plafonné à 95 %, i18n,
   zéro asset).
2. Créer `frontend/src/games/mon-jeu/MonJeu.tsx` (voir `MemoryCards.tsx` comme
   référence).
3. Ajouter le composant dans `frontend/src/games/registry.ts`.
4. Ajouter la ligne du jeu dans `backend/prisma/seed.ts` (slug, moteur, config
   anti-triche) puis `npm run seed`.

Aucune dépendance supplémentaire n'est nécessaire : le moteur fournit HUD,
pause, écran de fin, sons et sauvegarde locale.

---

## 📄 Licence & contact

Projet personnel — contact : `hello@kidora.example`.
Politique de confidentialité et conditions d'utilisation sont dans l'application
(les données des enfants sont traitées avec le plus grand soin : voir
`docs/SECURITY.md` §6).

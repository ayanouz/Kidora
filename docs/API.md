# KIDORA — Référence API

API REST JSON servie par Fastify sur `/api`. Toutes les réponses sont en JSON.
En développement : `http://localhost:4000`. En production : même origine que le
frontend (`https://<domaine>/api` via Nginx).

---

## 1. Authentification

| Élément | Détail |
|---|---|
| Access token | JWT, 15 min, cookie **HttpOnly** `kidora_at` (path `/`) |
| Refresh token | Opaque, 30 jours, cookie **HttpOnly** `kidora_rt` (path `/api/auth`), **rotatif** (usage unique) |
| Stockage serveur | Refresh token **haché SHA-256** en base (table `sessions`) |
| Renouvellement | `POST /api/auth/refresh` — rotation : l'ancien token est révoqué |
| Déconnexion | `POST /api/auth/logout` — révoque la session courante ou toutes (`allSessions: true`) |

Le client n'envoie **jamais** de token dans un en-tête : tout passe par les cookies
(`credentials: "include"`). Les cookies sont `SameSite=Lax` (Strict possible),
`Secure` en production (`COOKIE_SECURE=true`).

### Rôles

| Rôle | Accès |
|---|---|
| *(invité)* | Catalogue, jeux en local (scores non sauvegardés) |
| `USER` | + scores, progression, favoris, badges, classement (opt-in) |
| `PARENT` | + espace parents (`/api/parent/*`) |
| `ADMIN` | + administration (`/api/admin/*`) |

### Profils joueurs

Un compte peut gérer plusieurs **profils** (enfants). Le profil **actif**
(`activeProfileId` sur l'utilisateur) est celui utilisé pour les scores, les
favoris, la progression et le classement.

---

## 2. Format des erreurs

Toutes les erreurs suivent le même format :

```json
{
  "error": {
    "code": "CODE_MACHINE",
    "message": "Message en français, adapté aux enfants et aux parents.",
    "details": { "…": "optionnel" }
  }
}
```

| HTTP | `code` typiques | Quand |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Corps/query invalides (Zod) |
| 401 | `UNAUTHORIZED` | Non connecté ou token expiré |
| 403 | `FORBIDDEN` | Rôle insuffisant, profil non autorisé |
| 404 | `NOT_FOUND` | Ressource inconnue |
| 409 | `CONFLICT`, `EMAIL_TAKEN` | Unicité (email, slug, favori déjà présent) |
| 402 | `PREMIUM_REQUIRED` | Jeu 👑 démarré sans abonnement actif |
| 422 | `SCORE_REJECTED` | Score refusé par l'anti-triche |
| 429 | `RATE_LIMITED` | Trop de requêtes |

---

## 3. Limites de débit (rate limiting)

| Portée | Limite par défaut | Variable |
|---|---|---|
| Global `/api/*` | 200 req/min par IP | `RATE_LIMIT_MAX` |
| Routes d'auth sensibles | 10 req/min par IP | `AUTH_RATE_LIMIT_MAX` |
| Sessions terminées / profil | 60 / heure | `MAX_SESSIONS_PER_HOUR` |
| Nginx (défense en profondeur) | 20 r/s API, 1 r/s auth | `docker/nginx/nginx.conf` |

---

## 4. Endpoints

### 4.1 Santé & SEO

| Méthode | Chemin | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | `{ status, database, uptimeSec, version, timestamp }` (200/503) |
| GET | `/api/sitemap.xml` | — | Sitemap XML dynamique (jeux publiés + catégories). Exposé sur `/sitemap.xml` par Nginx |

### 4.2 Authentification — `/api/auth` *(rate limit renforcé)*

| Méthode | Chemin | Corps | Réponse |
|---|---|---|---|
| POST | `/register` | `{ displayName, email, password, ageTier?, acceptTerms: true }` | `{ user, profiles }` + cookies |
| POST | `/login` | `{ email, password }` | `{ user, profiles }` + cookies |
| POST | `/refresh` | *(cookie `kidora_rt`)* | nouveaux cookies |
| POST | `/logout` | `{ allSessions?: boolean }` | `{ loggedOut: true }` |
| POST | `/forgot-password` | `{ email }` | `{ sent: true }` (toujours 200, anti-énumération) |
| POST | `/reset-password` | `{ token, password }` | `{ updated: true }` |
| GET | `/me` | — | `{ user, profiles }` |

- Mot de passe : ≥ 8 caractères, au moins une lettre et un chiffre (bcrypt, facteur 12).
- Réinitialisation : lien à usage unique, valable `PASSWORD_RESET_TTL_MINUTES` (30 min).
- `ageTier` : `"3-5" | "6-8" | "9-11" | "12+"` (facultatif).

### 4.3 Utilisateurs — `/api/users`

| Méthode | Chemin | Corps | Description |
|---|---|---|---|
| GET | `/me` | — | Profil du compte |
| PUT | `/me` | `{ displayName?, avatar?, leaderboardOptIn? }` | Mise à jour |
| PUT | `/me/password` | `{ currentPassword, newPassword }` | Changement de mot de passe |
| POST | `/me/export` | — | Export RGPD (fichier JSON téléchargé) |
| DELETE | `/me` | `{ password, confirm: "SUPPRIMER" }` | Suppression du compte (RGPD) |

### 4.4 Profils joueurs — `/api`

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/profile` | Profil actif + stats personnelles |
| PUT | `/profile` | Mise à jour du profil actif (`displayName`, `avatar`, `ageTier`, `leaderboardOptIn`) |
| GET | `/profiles` | Liste des profils du compte |
| POST | `/profiles` | Créer un profil enfant |
| PUT | `/profiles/:id` | Modifier un profil |
| DELETE | `/profiles/:id` | Supprimer un profil (et ses données) |
| POST | `/profiles/:id/select` | Définir le profil actif |

### 4.5 Catalogue — `/api/games`, `/api/categories`

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/api/games` | Liste paginée. Query : `search`, `category`, `age`, `difficulty`, `sort` (`popular\|newest\|plays\|name`), `favorites=1`, `page`, `limit` |
| GET | `/api/games/:slug` | Détail d'un jeu (config, stats personnelles si connecté, top scores du jeu) |
| GET | `/api/categories` | Liste des catégories (avec compteur de jeux) |
| GET | `/api/categories/:slug` | Catégorie + jeux associés |

Les réponses incluent, si connecté, les stats personnelles du profil actif
(`personal: { bestScore, plays, level, stars, isFavorite, lastPlayedAt }`) et le
champ `premium` (booléen) ; les jeux 👑 exigent un abonnement actif pour
démarrer une session.

### 4.6 Sessions de jeu (anti-triche) — `/api/sessions`

Le **client n'écrit jamais de score**. Le flux est :

```text
POST /api/sessions/start    { gameSlug, difficulty }      → { sessionId, startedAt, config }
   … l'enfant joue (durée réelle mesurée côté serveur) …
POST /api/sessions/:id/finish
     { score, durationMs, isWin, levelReached, clientMeta? }
     → { accepted, score, stars, xpGained, pointsGained, levelUp,
         newAchievements[], isNewBest, bestScore, profileUpdate }
POST /api/sessions/:id/abandon                            → { abandoned: true }
GET  /api/sessions/resume/:slug                           → session à reprendre (optionnel)
```

| Méthode | Chemin | Auth | Description |
|---|---|---|---|
| POST | `/start` | oui | Ouvre une session (jeu publié + difficulté valides). Jeu 👑 sans abonnement → **402 `PREMIUM_REQUIRED`** |
| POST | `/:id/finish` | oui | Soumet le résultat ; validé côté serveur |
| POST | `/:id/abandon` | oui | Abandonne la session (quitter en pleine partie) |
| GET | `/resume/:slug` | oui | Dernière session non terminée (reprise en douceur) |

**Règles anti-triche appliquées au `finish` :**

1. La session doit appartenir au profil actif et être encore ouverte.
2. `durationMs` fourni est comparé au temps réel écoulé depuis `startedAt` ;
3. `durationMs` ≥ `config.minDurationMs[difficulty]` ;
4. `score` ≤ `config.maxScore[difficulty]` (ou `maxScoreHint`) ;
5. `levelReached` dans `[1, config.levels]` ;
6. Plafond d'activité : ≤ `MAX_SESSIONS_PER_HOUR` sessions terminées par profil.

Toute anomalie → **422 `SCORE_REJECTED`** (le jeu affiche un message doux) et une
entrée est écrite dans `security_logs` (visible dans l'onglet Sécurité de l'admin).

**Récompenses calculées côté serveur** : étoiles (40/70/90 % du max), XP, points
de classement, montée de niveau, badges débloqués, `profileUpdate` pour le store
frontend.

### 4.7 Scores & progression

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/api/scores?gameSlug=` | Historique des scores du profil actif (paginé) |
| GET | `/api/scores/best` | Meilleurs scores par jeu |
| GET | `/api/progress` | Résumé de progression (niveau, XP, points, stats par jeu/compétence) |

### 4.8 Favoris, badges, classement

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/api/favorites` | Liste des jeux favoris du profil actif |
| POST | `/api/favorites/:gameId` | Ajouter (idempotent) |
| DELETE | `/api/favorites/:gameId` | Retirer |
| GET | `/api/achievements` | Tous les badges + état débloqué/verrouillé |
| GET | `/api/achievements/recent` | Derniers badges débloqués |
| GET | `/api/leaderboard?period=day\|week\|month\|all&limit=20` | Classement — **pseudos uniquement**, profils opt-in |

### 4.9 Espace parents — `/api/parent` *(rôle `PARENT` ou `ADMIN`)*

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/children` | Liste des profils enfants + résumé (sessions, taux de réussite, temps de jeu, dernier jeu) |
| GET | `/dashboard/:profileId` | Détail : temps de jeu (jour/semaine/mois/total), compétences, activité par jeu, sessions récentes, badges débloqués |

`winRate` est un **pourcentage arrondi (0–100)**, pas une fraction.

### 4.10 Administration — `/api/admin` *(rôle `ADMIN`)*

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/stats` | Vue d'ensemble (utilisateurs, parties, scores, anomalies, tops) |
| GET | `/users` | Liste paginée + recherche |
| PATCH | `/users/:id` | Activer/désactiver un compte |
| DELETE | `/users/:id` | Supprimer un compte |
| GET | `/games` | Liste complète (y compris brouillons) |
| POST | `/games` | Créer un jeu |
| PUT | `/games/:id` | Modifier (titre, config, publication…) |
| DELETE | `/games/:id` | Supprimer |
| GET/POST | `/categories` | Lister / créer |
| PUT/DELETE | `/categories/:id` | Modifier / supprimer |
| GET | `/security-logs` | Journal des événements de sécurité (anti-triche, rate limit, auth) |

### 4.11 Abonnements Premium — `/api/billing`

| Méthode | Chemin | Auth | Description |
|---|---|---|---|
| GET | `/plans` | non | Formules publiées + `billing: { demoMode, stripeEnabled }` |
| GET | `/me` | oui | Statut Premium (`premium`, `premiumSource`), abonnement en cours, historique des paiements |
| POST | `/checkout` | oui | `{ planSlug }` → session Stripe (`url`) ou activation démo (`mode: "demo"`) |
| POST | `/confirm` | oui | `{ sessionId }` → vérification serveur de la session Stripe (retour d'écran) |
| POST | `/cancel` | oui | Annule le renouvellement ; l'accès reste actif jusqu'à `currentPeriodEnd` |
| POST | `/resume` | oui | Annule l'annulation programmée |

Règles :

- Le Premium est **vérifié côté serveur** au démarrage d'une partie ; un compte
  sans abonnement `ACTIVE` (période non expirée) reçoit `402 PREMIUM_REQUIRED`.
  Les comptes `ADMIN` sont exemptés.
- Sans clé `STRIPE_SECRET_KEY`, le **mode démo** permet d'activer une formule
  hors production (`BILLING_DEMO`, jamais actif par défaut en production) :
  essai de 7 jours et paiement 0 € enregistré pour l'historique.
- Avec Stripe : `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`,
  `STRIPE_PRICE_FAMILY` pointent vers les Price IDs. Le retour d'écran
  `?checkout=success&session_id=…` appelle `/confirm`; en production, ajouter un
  webhook `checkout.session.completed` pour ne pas dépendre du retour navigateur.

---

## 5. Format de la config de jeu (`config`)

```jsonc
{
  "levels": 3,                 // nombre de niveaux (≥ 1)
  "settings": { … },           // réglages spécifiques au moteur (voir GAMES-CONTRACT.md)
  "minDurationMs": { "easy": 20000, "medium": 30000, "hard": 45000 },
  "maxScore": { "easy": 900, "medium": 1200, "hard": 1500 }
}
```

`maxScoreHint` (colonne séparée) sert de plafond de secours si `maxScore[difficulty]`
est absent. Règle d'or des jeux : le cumul client ne dépasse jamais
`floor(cap × 0.95)`, pour qu'une partie parfaite reste acceptée par le serveur
et atteigne 3 étoiles.

---

## 6. Codes de succès utiles côté frontend

| Situation | Comportement attendu du client |
|---|---|
| 401 sur une requête | Tentative silencieuse de `POST /api/auth/refresh`, puis rejeu ; en cas d'échec → état invité |
| 422 `SCORE_REJECTED` sur `finish` | Écran de fin avec le message doux « score non validé », pas d'erreur brutale |
| Réseau indisponible | Mode local : le score est conservé sur l'appareil, l'écran de fin indique « hors-ligne » |
| 429 | Message d'attente, jamais de blocage brutal |

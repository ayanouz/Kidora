# KIDORA — Sécurité, vie privée et anti-triche

Ce document décrit les protections en place, les décisions prises et les
procédures à suivre en cas d'incident. Public visé : équipe technique,
hébergeur et responsables RGPD.

---

## 1. Modèle de menace

| Menace | Contre-mesure principale |
|---|---|
| Vol de mot de passe (fuite DB) | bcrypt facteur 12 — jamais de mot de passe en clair |
| Vol de session (XSS) | Tokens en cookies **HttpOnly**, jamais dans `localStorage` |
| Vol de session (CSRF) | `SameSite=Lax`, vérification d'**Origin** sur les mutations, CORS verrouillé |
| Force brute / credential stuffing | Rate limit auth (10/min/IP), logs `security_logs`, bcrypt coûteux |
| Spam de comptes / énumération d'emails | `forgot-password` répond toujours 200, register rate-limité |
| Scores truqués « côté client » | **Aucun score écrit par le client** : sessions serveur start→finish (voir §4) |
| Injection SQL | Prisma (requêtes paramétrées), aucune requête brute |
| XSS | React échappe par défaut ; CSP Nginx ; aucun `dangerouslySetInnerHTML` |
| Clickjacking | `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'` |
| Fuite de données enfants | Pseudos uniquement, classement **opt-in**, aucune donnée revendue ni publicité |
| Déni de service applicatif | Rate limits (API + Nginx), body 128 Ko, timeouts, healthchecks |
| Dépendances compromises | Versions verrouillées, peu de dépendances, `npm audit` en CI |

Hors périmètre : protection DDoS réseau (à déléguer au fournisseur cloud),
compromission de l'hôte (endurcir l'OS, accès SSH par clé uniquement).

---

## 2. Authentification

- **Mots de passe** : ≥ 8 caractères avec lettre + chiffre, hachés avec
  **bcrypt (12 rounds)**. Jamais loggués, jamais renvoyés, jamais stockés en clair.
- **Access token** : JWT 15 min (`ACCESS_TOKEN_TTL`), signé avec `JWT_SECRET`
  (≥ 64 caractères aléatoires), transmis par cookie `kidora_at` HttpOnly,
  `SameSite=Lax`, `Secure` en production.
- **Refresh token** : opaque (256 bits), **haché SHA-256 en base**, **rotatif** —
  chaque `refresh` révoque l'ancien et en émet un nouveau. Réutilisation d'un
  ancien token détectée ⇒ session révoquée. Durée : 30 jours
  (`REFRESH_TOKEN_TTL_DAYS`).
- **Réinitialisation de mot de passe** : token à usage unique haché, valable
  30 min (`PASSWORD_RESET_TTL_MINUTES`), réponse identique que l'email existe
  ou non (anti-énumération).
- **Déconnexion** : révoque la session courante ; `allSessions: true` révoque
  toutes les sessions de l'utilisateur.
- **Suppression de compte** : exige le mot de passe **et** la saisie exacte de
  `SUPPRIMER` (côté serveur : `z.literal`, pas seulement côté client).

---

## 3. Cookies & navigateur

| Cookie | Path | Contenu | Durée |
|---|---|---|---|
| `kidora_at` | `/` | JWT d'accès signé | 15 min |
| `kidora_rt` | `/api/auth` | Refresh opaque (haché en base) | 30 jours |

- `HttpOnly` : inaccessible au JavaScript de la page (protection XSS).
- `SameSite=Lax` : les requêtes cross-site ne transportent pas la session.
- `Secure` : activé en production (`COOKIE_SECURE=true`).
- **Origin check** : le plugin sécurité refuse (403) toute mutation (`POST/PUT/PATCH/DELETE`)
  dont l'en-tête `Origin` ne fait pas partie des origines autorisées.
- **localStorage** : uniquement des préférences non sensibles (langue, sons,
  meilleurs scores locaux hors-ligne). Aucun token n'y est jamais stocké.

---

## 4. Anti-triche des scores (le cœur de la confiance)

Principe : **le client ne fait que raconter ce qui s'est passé ; le serveur décide.**

```text
start ──► session ouverte en base (hold: startedAt, difficulty)
  │
  ├─ le client joue ; le score s'incrémente LOCALEMENT (ctx.addScore)
  │
finish ─► le serveur valide :
          1. session ouverte, propriétaire = profil actif
          2. durée réelle ≥ durée annoncée ± tolérance
          3. durée ≥ minDurationMs[difficulty]
          4. score ≤ maxScore[difficulty] (ou maxScoreHint)
          5. niveau ∈ [1, config.levels]
          6. ≤ MAX_SESSIONS_PER_HOUR sessions/heure/profil
          ✅ → étoiles, XP, points, badges, classement (calculés serveur)
          ❌ → 422 SCORE_REJECTED + entrée security_logs
```

Côté jeu (voir `docs/GAMES-CONTRACT.md`), le cumul est plafonné à
`floor(cap × 0.95)` : même une partie parfaite passe la validation et décroche
3 étoiles (seuil 90 %), sans jamais pouvoir dépasser le plafond serveur.

Les sessions **abandonnées** n'accordent rien et n'écrivent pas de score.
Un onglet fermé en pleine partie déclenche un `abandon` (best-effort).

---

## 5. Validation & hygiène des données

- **Zod partout** : chaque corps, query et paramètre d'URL est validé et typé
  avant d'atteindre les services (`parseBody`, `parseQuery`, `parseParams`).
- **Prisma** : requêtes paramétrées uniquement ; aucune concaténation SQL.
- **Body limit** 128 Ko ; JSON malformé → 400 sans détail interne.
- **Erreurs** : les erreurs internes ne fuient jamais (message générique +
  détail de debug uniquement hors production).
- **Logs** : Pino ; aucune donnée sensible (mot de passe, tokens) n'est loggée.
  Les événements sensibles partent dans `security_logs` (IP, type, détail).

---

## 6. Vie privée des enfants (RGPD / « privacy by design »)

- **Aucune publicité, aucun traqueur tiers, aucun cookie analytique.**
- **Aucune donnée réelle demandée aux enfants** : seuls des **pseudos** et un
  avatar emoji sont stockés dans les profils joueurs.
- **Classement en pseudonymes uniquement**, sur **opt-in explicite** du parent
  (`leaderboardOptIn`), désactivable à tout moment.
- **Email du compte** : celui du parent/tuteur (création de compte par un adulte).
- **Tranche d'âge** facultative, utilisée seulement pour proposer des jeux adaptés.
- **Droit à l'export** : `POST /api/users/me/export` télécharge un JSON complet.
- **Droit à l'effacement** : `DELETE /api/users/me` supprime compte, profils,
  scores, progression et badges (cascade Prisma).
- **Minimisation** : pas de géolocalisation, pas de nom réel, pas d'upload de
  photo, pas de chat entre utilisateurs.
- **Sons et animations** : contrôle parental intégré (coupure des sons,
  animations respectueuses de `prefers-reduced-motion`).

---

## 7. En-têtes HTTP (Nginx)

```text
Content-Security-Policy: default-src 'self'; script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:;
  media-src 'self' blob:; connect-src 'self'; object-src 'none';
  base-uri 'self'; frame-ancestors 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains  (HTTPS uniquement)
```

`'unsafe-inline'` sur les styles est requis par React (styles inline de
positionnement canvas) ; **aucun** `unsafe-inline` sur les scripts.

---

## 8. Gestion des secrets

- Secrets générés avec : `openssl rand -base64 48`.
- **Jamais commités** : `.env` est dans `.gitignore` (seul `.env.example` est versionné).
- En production : variables d'environnement injectées par l'orchestrateur/OS
  (Docker `env_file` ou coffre-fort type Vault/Doppler/Secrets Manager).
- Rotation conseillée : `JWT_SECRET`/`SESSION_SECRET` tous les 6–12 mois
  (déconnecte tout le monde — prévenir les utilisateurs), mots de passe DB
  tous les 12 mois.
- Fuite suspectée : révoquer tous les refresh tokens (`sessions`), régénérer
  les secrets, forcer la réinitialisation des mots de passe admin.

---

## 9. Réponse à incident (checklist express)

1. **Isoler** : couper l'accès public si nécessaire (`docker compose stop nginx`).
2. **Constater** : `docker compose logs backend`, onglet **Sécurité** de l'admin,
   table `security_logs` (filtre par type et IP).
3. **Contenir** : désactiver les comptes concernés (admin → Utilisateurs),
   révoquer les sessions (`DELETE FROM sessions WHERE ...` ou reset mot de passe).
4. **Corriger & restaurer** : appliquer le correctif, restaurer depuis la
   dernière sauvegarde saine si corruption (`docs/BACKUP.md`).
5. **Notifier** : si des données personnelles sont concernées, notifier le
   responsable RGPD sous 72 h et documenter l'incident.

---

## 10. Tests de sécurité intégrés

- Tests unitaires : validation Zod, logique anti-triche (`score-validator`),
  calculs XP/étoiles/niveaux, hachage des refresh tokens.
- Tests d'intégration backend : 401/403 sur routes protégées, 403 sur origine
  invalide, 429 après rafale sur `/api/auth/login`.
- E2E Playwright : parcours de jeu complet, connexion, espace parents, admin.

Commandes :

```bash
npm run test          # unitaires + intégration (backend + frontend)
npm run test:e2e      # parcours navigateur (app + base seedées requises)
npm audit             # vulnérabilités des dépendances
```

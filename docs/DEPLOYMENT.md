# KIDORA — Déploiement

Guide pas-à-pas : développement local, production Docker Compose, mise à jour,
rollback et dépannage.

---

## 1. Prérequis

| Outil | Version | Usage |
|---|---|---|
| Node.js | ≥ 20 LTS | Développement, build, seed |
| PostgreSQL | ≥ 16 | Base de données |
| Docker + Compose | récents | Déploiement conteneurisé |
| OpenSSL | — | Génération des secrets |
| Nginx | via Docker | Reverse proxy (fourni) |

```bash
git clone <dépôt> kidora && cd kidora
cp .env.example .env
```

Générer les secrets dans `.env` :

```bash
openssl rand -base64 48   # → JWT_SECRET
openssl rand -base64 48   # → SESSION_SECRET
openssl rand -base64 24   # → POSTGRES_PASSWORD
```

---

## 2. Variables d'environnement

Toutes les variables sont documentées dans `.env.example`. Rappel des plus
importantes :

| Variable | Rôle | Exemple production |
|---|---|---|
| `NODE_ENV` | Environnement | `production` |
| `PORT` | Port API | `4000` |
| `FRONTEND_URL` | URL publique (CORS, sitemap, emails) | `https://kidora.example` |
| `API_URL` | URL publique de l'API | `https://kidora.example` |
| `DATABASE_URL` | Connexion PostgreSQL | `postgresql://kidora:…@postgres:5432/kidora` |
| `POSTGRES_DB/USER/PASSWORD` | Conteneur PostgreSQL | `kidora / kidora / …` |
| `JWT_SECRET` | Signature des JWT (**64+ caractères**) | généré par openssl |
| `SESSION_SECRET` | Signature cookies | généré par openssl |
| `ACCESS_TOKEN_TTL` | Durée du JWT d'accès | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | Durée du refresh | `30` |
| `COOKIE_SECURE` | `true` derrière HTTPS | `true` |
| `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` | Limites req/min | `200` / `10` |
| `MAX_SESSIONS_PER_HOUR` | Anti-triche (sessions/heure/profil) | `60` |
| `MAIL_*` | SMTP mot de passe oublié | voir §5 |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (**production**) | `sk_live_…` |
| `STRIPE_PRICE_MONTHLY/YEARLY/FAMILY` | Price IDs des formules | `price_…` |
| `BILLING_DEMO` | Active l'abonnement démo hors Stripe ; **laisser vide/false en production** | `false` |
| `DOMAIN` | Domaine public (TLS) | `kidora.example` |

---

## 3. Développement local (sans Docker)

```bash
cp .env.example .env             # PowerShell : Copy-Item .env.example .env
npm install                      # workspaces backend + frontend
createdb kidora                  # ou psql -c "CREATE DATABASE kidora;"
npm run migrate -- --name init   # 1re fois : crée la migration initiale
npm run seed                     # données de démo (jeux, badges, comptes)
npm run dev                      # API :4000 + frontend :5173 (proxy /api)
```

Le backend lit le `.env` **à la racine du dépôt** (`DATABASE_URL` en
`localhost:5432`).

- Frontend : http://localhost:5173 (le `/api` est proxifié vers :4000).
- API : http://localhost:4000/api/health.
- Comptes de démo (après seed) :
  - `admin@kidora.dev` / `Admin1234!`
  - `parent@kidora.dev` / `Parent1234!` (enfants Adam et Lina)
  - `pixelkid@kidora.dev` / `Demo1234!`

---

## 4. Production — Docker Compose

### 4.1 Premier déploiement

```bash
# 1. Renseigner .env (voir §2), avec COOKIE_SECURE=true et les vraies URLs
# 2. Construire et démarrer
docker compose up -d --build

# 3. Données initiales (jeux, catégories, badges)
# Le schéma se synchronise automatiquement au démarrage du backend :
#  • backend/prisma/migrations/ existe → npx prisma migrate deploy
#  • sinon (premier run)               → npx prisma db push --skip-generate
docker compose exec backend npm run seed     # ⚠️ une seule fois (idempotent, mais optionnel en prod)

# 4. Vérifier la santé
curl -fsS http://localhost/api/health
```

> **Première migration versionnée** : pour basculer sur des migrations Prisma,
> exécuter une fois sur une machine avec Node ≥ 20 :
> `npm install && npm run migrate -- --name init`, puis committer
> `backend/prisma/migrations/`. Les déploiements suivants appliqueront
> automatiquement `migrate deploy`.

Topologie : `nginx :80/:443` → `frontend` (build React servi par Nginx interne)
et `backend` (Fastify :4000) → `postgres` (volume `pgdata`).

### 4.2 HTTPS

1. Obtenir les certificats (Let's Encrypt / certbot webroot → `docker/nginx/www`).
2. Placer `fullchain.pem` et `privkey.pem` dans `docker/nginx/certs/`.
3. Décommenter le bloc HTTPS de `docker/nginx/nginx.conf` et le redirect 80→443
   (voir commentaires dans le fichier), puis :

```bash
docker compose restart nginx
```

HSTS est déjà présent dans le bloc HTTPS (à activer seulement quand HTTPS est stable).

### 4.3 Mise à jour (zéro stress)

```bash
# Sauvegarde AVANT toute mise à jour
./database/backup.sh

git pull
docker compose build backend frontend
docker compose up -d backend frontend     # rolling remplacement des conteneurs
docker compose exec backend npx prisma migrate deploy
curl -fsS http://localhost/api/health
```

L'ordre compte : **backup → build → up → migrate → check**. Les migrations
Prisma sont additives dans ce projet ; en cas de migration destructive, prévoir
une fenêtre de maintenance.

### 4.4 Rollback

```bash
git checkout <tag-ou-commit-précédent>
docker compose build backend frontend && docker compose up -d backend frontend
# Si la base doit aussi revenir en arrière :
docker compose exec -T postgres dropdb -U kidora --if-exists kidora
./database/restore.sh database/backups/<fichier>.sql.gz
```

---

## 5. Emails (mot de passe oublié)

- **Développement** : `MAIL_DRY_RUN=true` — les liens sont écrits dans les logs
  du backend (`docker compose logs -f backend` / console `npm run dev`).
- **Production** : renseigner `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`, et
  `MAIL_DRY_RUN=false`. Tout fournisseur SMTP (Brevo, Mailgun, SES, Postmark…)
  fonctionne ; utiliser un sous-domaine d'envoi dédié (SPF/DKIM).

---

## 6. Après le déploiement — checklist

- [ ] `curl -fsS http://<domaine>/api/health` → `status: ok`
- [ ] Page d'accueil, catalogue et un jeu s'ouvrent (desktop + mobile)
- [ ] Inscription + connexion fonctionnent (cookies `Secure` en HTTPS)
- [ ] Une partie connectée enregistre score, XP et étoiles (vérifier le profil)
- [ ] Espace parents : un enfant apparaît avec son temps de jeu
- [ ] Premium : Stripe configuré (`sk_live`, Price IDs), un paiement test active
      bien l'abonnement (`/api/billing/me` → `premium: true`) ; sinon vérifier
      que le mode démo est **désactivé** en production
- [ ] Admin : stats visibles, onglet Sécurité vide de toute anomalie
- [ ] `/sitemap.xml` répond (proxy vers l'API) et `robots.txt` est servi
- [ ] Sauvegarde automatique planifiée (voir `docs/BACKUP.md`)
- [ ] Supervision en place (voir `docs/MONITORING.md`)

---

## 7. Dépannage

| Symptôme | Piste |
|---|---|
| `POSTGRES_PASSWORD requis` | Variable absente du `.env` à la racine |
| Backend redémarre en boucle | `docker compose logs backend` — souvent `DATABASE_URL` ou migration non appliquée |
| 502 sur `/api/*` | Backend pas prêt : healthcheck `depends_on` retarde Nginx, vérifier `logs backend` |
| Cookies absents en HTTPS | `COOKIE_SECURE=true` + `FRONTEND_URL` en https + restaurer via HTTPS (pas IP) |
| CORS bloqué | `FRONTEND_URL` doit correspondre EXACTEMENT à l'origine du navigateur (schéma + domaine) |
| Rate limit trop strict (salon familial = même IP) | Augmenter `RATE_LIMIT_MAX` (p. ex. 600) et `AUTH_RATE_LIMIT_MAX` (p. ex. 30) |
| Liens de reset non reçus | `MAIL_DRY_RUN` encore à `true`, ou SMTP mal configuré |
| `prisma migrate deploy` échoue | Vérifier les droits de l'utilisateur DB et la connexion (`DATABASE_URL`) |

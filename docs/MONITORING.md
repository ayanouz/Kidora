# KIDORA — Supervision & exploitation

Objectif : détecter les problèmes **avant** les familles. Ce document couvre la
santé technique, les journaux, les indicateurs métier et les alertes.

---

## 1. Sonde de santé

```bash
curl -fsS http://localhost/api/health
```

```json
{
  "status": "ok",            // "degraded" si la base est injoignable (HTTP 503)
  "database": "connected",
  "uptimeSec": 84210,
  "version": "1.0.0",
  "timestamp": "2026-10-17T12:00:00.000Z"
}
```

- **200** = API + base opérationnelles.
- **503** = API debout mais base injoignable → incident à traiter immédiatement.

Le healthcheck Docker du backend interroge cette route toutes les 30 s
(3 échecs → conteneur marqué `unhealthy`).

### Supervision externe (recommandé)

| Service | Configuration |
|---|---|
| UptimeRobot / Better Stack / Healthchecks.io | Ping `https://<domaine>/api/health` toutes les 1–5 min, alerte si ≠ 200 |
| Test navigateur synthétique | Ouvrir `/` et `/games` (détecte un frontend cassé que l'API saine ne révèle pas) |

---

## 2. Journaux

### Backend (Pino → stdout)

```bash
docker compose logs -f --tail=200 backend
docker compose logs --since=1h backend | grep '"level":50'   # erreurs
```

- Développement : logs colorés lisibles.
- Production : JSON structuré (`level`, `time`, `msg`, `reqId`, …).
- `reqId` (Fastify) permet de suivre une requête de bout en bout.
- Les données sensibles (mots de passe, tokens) ne sont **jamais** loggées.

### Nginx (accès + erreurs)

```bash
docker compose logs -f nginx
# Volumétrie : compter les 5xx de la dernière heure
docker compose logs --since=1h nginx | grep ' 50[0-9] ' | wc -l
```

### Rotation

- Docker : rotation par défaut (json-file, 10 Mo × 3–5 fichiers). Ajuster dans
  `docker-compose.yml` si le volume de logs grandit (`logging.driver: json-file`
  + `max-size`/`max-file`).
- Hôte : `logrotate` sur les scripts cron (ex. `/var/log/kidora-backup.log`).

---

## 3. Indicateurs métier (onglet Admin → Vue d'ensemble)

Accessibles à tout moment sur `https://<domaine>/admin` (compte ADMIN) :

| Indicateur | Ce qu'il révèle |
|---|---|
| Utilisateurs / nouveaux (7 j) / profils enfants | Croissance et adoption |
| Utilisateurs actifs (7 j) | Éngagement réel |
| Parties totales / 7 jours / durée moyenne | Usage et santé des jeux |
| Jeux les plus joués | Ce qui plaît (alimente les recommandations) |
| Meilleurs taux de réussite | Jeux trop faciles ou triche potentielle |
| Parties abandonnées | Jeux trop durs, bugs de fin de partie |
| Anomalies de sécurité (30 j) | Anti-triche et auth (voir §4) |

### Onglet Sécurité (`security_logs`)

Chaque entrée : type, IP, profil/utilisateur concerné, détail, date.
Types principaux :

| Type | Signification | Réaction |
|---|---|---|
| `SCORE_REJECTED` | Score invalide (durée, plafond, niveau) | Isolé : probablement un bug de jeu ; répété sur une IP → abus |
| `RATE_LIMITED` | Rafale sur l'API/auth | Isolé : normal (salon familial). Massif : brute force |
| `INVALID_CREDENTIALS` répétés | Tentatives de connexion échouées | Surveiller l'IP concernée |
| `ORIGIN_REJECTED` | Mutation avec origine invalide | Tentative CSRF → vérifier le domaine configuré |

---

## 4. Alertes suggérées

| Alerte | Seuil | Gravité |
|---|---|---|
| `/api/health` ≠ 200 | 2 échecs consécutifs | 🔴 Critique |
| Conteneur `unhealthy` ou redémarrages > 3 / 15 min | Docker events | 🔴 Critique |
| Espace disque < 15 % | Disque hôte | 🔴 Critique |
| `SCORE_REJECTED` > 50 / heure | Anomalie métrique | 🟠 À investiguer |
| `INVALID_CREDENTIALS` > 100 / heure (même IP) | Bruteforce | 🟠 À investiguer |
| Taux 5xx Nginx > 2 % sur 15 min | Erreurs serveur | 🟠 À investiguer |
| Échec de la sauvegarde nocturne | Log cron/backup | 🟠 (🔴 si 2 nuits) |
| Latence p95 API > 1 s | Métrique proxy | 🟡 Surveiller |

---

## 5. Commandes d'exploitation utiles

```bash
# État global
docker compose ps

# Consommation temps réel
docker stats --no-stream

# Connexions actives à PostgreSQL
docker compose exec postgres psql -U kidora -d kidora \
  -c "SELECT count(*) FROM pg_stat_activity WHERE datname='kidora';"

# Sessions ouvertes (jeux en cours)
docker compose exec postgres psql -U kidora -d kidora \
  -c "SELECT count(*) FROM sessions WHERE status='STARTED';"

# Révoquer TOUTES les sessions (déconnexion globale d'urgence)
docker compose exec postgres psql -U kidora -d kidora \
  -c "DELETE FROM sessions;"

# Redémarrage ciblé sans toucher à la base
docker compose restart backend nginx

# Taille de la base
docker compose exec postgres psql -U kidora -d kidora \
  -c "SELECT pg_size_pretty(pg_database_size('kidora'));"
```

---

## 6. Maintenance périodique

| Fréquence | Action |
|---|---|
| Quotidien | (Automatique) sauvegarde ; vérifier les alertes reçues |
| Hebdomadaire | Lire l'onglet Sécurité, purger si des comptes manifestement inactifs, vérifier l'espace disque |
| Mensuel | `npm audit` sur le dépôt, mises à jour images Docker (`postgres:16-alpine`, `nginx:1.27-alpine`), vérifier les certificats TLS (< 30 j restants) |
| Trimestriel | Exercice de restauration (`docs/BACKUP.md` §6), revue des rôles admin, rotation des logs archivés |
| Semestriel / annuel | Rotation des secrets (`JWT_SECRET`, `SESSION_SECRET`), revue RGPD, mise à jour de ce guide |

---

## 7. Limites connues (périmètre volontaire)

- Pas de stack Prometheus/Grafana embarquée : pour un déploiement familial,
  health-check + logs + admin suffisent. Si la plateforme grossit : exporter
  les métriques Fastify (`@fastify/metrics`) et brancher un tableau de bord.
- Pas de tracing distribué (monolithe unique, une seule base).
- Les journaux Docker json-file sont perdus si l'hôte meurt : si c'est
  inacceptable, brancher le driver `gelf`/`journald` ou un collecteur (Vector,
  Fluent Bit).

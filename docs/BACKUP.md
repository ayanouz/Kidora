# KIDORA — Sauvegardes & restauration

La base PostgreSQL est la **seule source de vérité** (comptes, profils, scores,
progression, badges). Elle doit être sauvegardée régulièrement et testée.

---

## 1. Stratégie recommandée

| Type | Fréquence | Conservation | Contenu |
|---|---|---|---|
| Sauvegarde complète | **quotidienne** (03:00) | 30 jours | `pg_dump` compressé (schéma + données) |
| Sauvegarde avant mise à jour | à chaque déploiement | 7 jours | idem, préfixe `pre-deploy` |
| Copie hors-site | **hebdomadaire** | 8 semaines | transfert chiffré (S3, Backblaze, NAS distant) |

Rétention indicative : 7 quotidiennes + 4 hebdomadaires + 12 mensuelles couvre
la plupart des besoins. Un volume de données « familial » pèse quelques Mo —
aucune excuse pour ne pas garder un historique confortable.

**Règle d'or : une sauvegarde jamais testée n'est pas une sauvegarde.**
Tester une restauration au moins une fois par trimestre (§6).

---

## 2. Scripts fournis

| Script | Rôle |
|---|---|
| `database/backup.sh` | Sauvegarde complète (pg_dump + gzip) dans `database/backups/`, purge des anciennes |
| `database/restore.sh` | Restauration depuis un fichier `.sql.gz` (avec confirmation) |

Les scripts détectent automatiquement l'environnement :

- **Docker** : si le conteneur `kidora-postgres` tourne → `docker compose exec`;
- **Local** : sinon → `pg_dump`/`psql` locaux avec `DATABASE_URL`.

### Utilisation

```bash
# Sauvegarde (crée database/backups/kidora_2026-10-17_0300.sql.gz)
./database/backup.sh

# Sauvegarde pré-déploiement avec un préfixe personnalisé
./database/backup.sh pre-deploy

# Lister les sauvegardes
ls -lh database/backups/

# Restaurer (demande une confirmation interactive)
./database/restore.sh database/backups/kidora_2026-10-17_0300.sql.gz
```

Options :

| Variable | Défaut | Rôle |
|---|---|---|
| `BACKUP_DIR` | `database/backups` | Dossier de destination |
| `KEEP_DAYS` | `30` | Purge des sauvegardes plus vieilles que N jours |
| `POSTGRES_SERVICE` / `POSTGRES_CONTAINER` | `postgres` / `kidora-postgres` | Noms Docker |
| `PGUSER` / `PGDB` | `kidora` | Utilisateur / base |

> Windows : lancer les scripts depuis **Git Bash**, **WSL** ou un terminal
> compatible POSIX (`bash database/backup.sh`).

---

## 3. Planification automatique

### Linux (cron hôte)

```cron
# Sauvegarde quotidienne à 03:00 + copie hors-site le dimanche
0 3 * * *   cd /srv/kidora && ./database/backup.sh >> /var/log/kidora-backup.log 2>&1
0 4 * * 0   rsync -az database/backups/ backup@nas.local:/srv/backups/kidora/ && \
            rclone copy database/backups/ remote:kidora-backups/
```

### Docker (sidecar cron)

```yaml
# Extrait de docker-compose : service de sauvegarde planifiée
backup:
  image: alpine:3.20
  restart: unless-stopped
  volumes:
    - ./database:/database
    - ./backups-cron:/var/spool/cron/crontabs
  command: >
    sh -c "apk add --no-cache postgresql16-client tzdata &&
           echo '0 3 * * * /bin/sh /database/backup.sh' > /etc/crontabs/root &&
           crond -f -l 8"
```

(Adapter selon l'infrastructure ; le simple cron hôte reste le plus lisible.)

---

## 4. Procédure de restauration

1. **Prévenir** : idéalement une fenêtre courte — la restauration écrase la base.
2. **Sauvegarder l'état actuel** (même corrompu, il documente l'incident) :
   `./database/backup.sh pre-restore`
3. **Arrêter les écritures** :
   `docker compose stop backend` (le frontend peut rester, l'API répondra 502).
4. **Restaurer** :
   `./database/restore.sh database/backups/<fichier>.sql.gz`
   Le script recrée la base (drop/create), réimporte, puis vérifie les tables.
5. **Redémarrer** : `docker compose start backend`
6. **Vérifier** :
   - `curl -fsS http://localhost/api/health` → `ok`
   - Connexion avec un compte de test, une partie enregistrée, espace parents OK.
7. **Documenter** : date, cause, fichier restauré, durée d'indisponibilité.

---

## 5. Ce qui n'est PAS dans la base

| Élément | Où | Sauvegarde |
|---|---|---|
| Build frontend | image Docker / `frontend/dist` | reproductible depuis le code |
| `sw.js`, `manifest`, `icon.svg` | `frontend/public/` | versionnés dans Git |
| Certificats TLS | `docker/nginx/certs/` | à sauvegarder séparément (sensible !) |
| `.env` de production | coffre-fort / opérateur | à sauvegarder dans un coffre |
| Logs applicatifs | journal Docker | optionnels (rotation par défaut) |

Le **code** est versionné dans Git ; la sauvegarde Git (dépôt distant) est donc
indispensable en complément de la sauvegarde base.

---

## 6. Vérification trimestrielle (exercice de restauration)

```bash
# 1. Sauvegarder la production
./database/backup.sh

# 2. Restaurer dans une base JETABLE (jamais la prod !)
createdb kidora_drill
gunzip -c database/backups/<dernier>.sql.gz | psql kidora_drill
psql kidora_drill -c "SELECT count(*) FROM profiles; SELECT count(*) FROM sessions;"

# 3. Comparer les compteurs avec la production, puis supprimer la base d'essai
dropdb kidora_drill
```

Consigner la date de l'exercice et le résultat dans le journal d'exploitation.

---

## 7. En cas de perte totale (scénario catastrophe)

1. Nouveau serveur → installer Docker, cloner le dépôt, restaurer `.env` (coffre).
2. `docker compose up -d --build` (base vide créée par PostgreSQL).
3. Restaurer la dernière sauvegarde hors-site avec `restore.sh`.
4. Restaurer les certificats TLS, redémarrer Nginx.
5. Dérouler la checklist post-déploiement (`docs/DEPLOYMENT.md` §6).
6. Prévenir les familles si des parties récentes (depuis la dernière sauvegarde)
   sont perdues — c'est rare et sans gravité, mais la transparence rassure.

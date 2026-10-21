# KIDORA — Dossier `database/`

Outils de sauvegarde et de restauration de la base PostgreSQL.

```
database/
├── backup.sh      # Sauvegarde complète (pg_dump + gzip) + purge automatique
├── restore.sh     # Restauration depuis un fichier .sql.gz (avec confirmation)
├── backups/       # Fichiers de sauvegarde (ignorés par Git)
└── README.md      # Ce fichier
```

## Sauvegarde

```bash
./database/backup.sh                  # → backups/kidora_2026-10-17_0300.sql.gz
./database/backup.sh pre-deploy       # préfixe personnalisé
KEEP_DAYS=60 ./database/backup.sh     # garder 60 jours au lieu de 30
```

- Détecte Docker (conteneur `kidora-postgres`) ou un PostgreSQL local
  (`DATABASE_URL` / variables `PG*`).
- Purge automatique des fichiers de plus de `KEEP_DAYS` jours (défaut : 30).
- Exécuter depuis **Git Bash** ou **WSL** sous Windows.

## Restauration

```bash
./database/restore.sh database/backups/kidora_2026-10-17_0300.sql.gz
# ⚠️ demandera « OUI » : la base sera RECRÉÉE
```

## Planification

Voir `docs/BACKUP.md` (cron, copie hors-site, exercice de restauration
trimestriel, scénario catastrophe).

## Bonnes pratiques

1. **Sauvegarder avant chaque mise à jour** (`backup.sh pre-deploy`).
2. **Tester une restauration** au moins une fois par trimestre.
3. **Copier hors-site** (S3, NAS, rclone) — une sauvegarde sur le même disque
   ne protège pas d'une panne matérielle.
4. Ne **jamais** committer `backups/` (déjà dans `.gitignore`) : les dumps
   contiennent des données personnelles (emails des parents).

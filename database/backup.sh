#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  KIDORA — Sauvegarde PostgreSQL (pg_dump + gzip)
#
#  Usage :
#    ./database/backup.sh                 → kidora_2026-10-17_0300.sql.gz
#    ./database/backup.sh pre-deploy      → pre-deploy_2026-10-17_0300.sql.gz
#
#  Détecte automatiquement :
#    • Docker  : si le conteneur « kidora-postgres » tourne
#    • Local   : sinon, utilise pg_dump avec DATABASE_URL (ou PG*)
#
#  Variables optionnelles :
#    BACKUP_DIR (défaut: database/backups)   KEEP_DAYS (défaut: 30)
#    POSTGRES_CONTAINER (défaut: kidora-postgres)
#    PGUSER / PGDB (défaut: kidora / kidora)
#    DATABASE_URL (restauration/backup local)
#
#  Windows : exécuter depuis Git Bash ou WSL.
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
CONTAINER="${POSTGRES_CONTAINER:-kidora-postgres}"
PGUSER="${PGUSER:-kidora}"
PGDB="${PGDB:-kidora}"

PREFIX="${1:-kidora}"
STAMP="$(date +%Y-%m-%d_%H%M)"
TARGET="$BACKUP_DIR/${PREFIX}_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
TMP_FILE="$TARGET.partial"
trap 'rm -f "$TMP_FILE"' EXIT

echo "🗄️  KIDORA — Sauvegarde PostgreSQL"
echo "   Destination : $TARGET"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
  echo "   Mode        : Docker ($CONTAINER)"
  docker exec "$CONTAINER" pg_dump --clean --if-exists --no-owner \
    -U "$PGUSER" -d "$PGDB" | gzip -9 > "$TMP_FILE"
else
  echo "   Mode        : local (pg_dump)"
  if command -v pg_dump >/dev/null 2>&1; then
    if [ -n "${DATABASE_URL:-}" ]; then
      pg_dump --clean --if-exists --no-owner "$DATABASE_URL" | gzip -9 > "$TMP_FILE"
    else
      pg_dump --clean --if-exists --no-owner -U "$PGUSER" -d "$PGDB" | gzip -9 > "$TMP_FILE"
    fi
  else
    echo "❌ pg_dump introuvable et conteneur Docker « $CONTAINER » non démarré."
    echo "   → Démarre la base (docker compose up -d postgres) ou installe postgresql-client."
    exit 1
  fi
fi

if [ ! -s "$TMP_FILE" ]; then
  echo "❌ Sauvegarde vide — quelque chose s'est mal passé."
  exit 1
fi

mv "$TMP_FILE" "$TARGET"
SIZE="$(du -h "$TARGET" | cut -f1)"
echo "✅ Sauvegarde OK ($SIZE)."

# ── Purge des sauvegardes trop anciennes ──────────────────────────
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name '*.sql.gz' -type f -mtime "+$KEEP_DAYS" -print -delete | wc -l | tr -d ' ')"
if [ "$DELETED" != "0" ]; then
  echo "🧹 $DELETED sauvegarde(s) de plus de $KEEP_DAYS jours purgée(s)."
fi

echo "   Fichiers conservés : $(find "$BACKUP_DIR" -maxdepth 1 -name '*.sql.gz' -type f | wc -l | tr -d ' ')"

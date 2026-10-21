#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  KIDORA — Restauration PostgreSQL
#
#  Usage :
#    ./database/restore.sh database/backups/kidora_2026-10-17_0300.sql.gz
#
#  ⚠️ ÉCRASE la base cible. Le script demande une confirmation explicite.
#     (Sauvegarde d'abord l'état actuel : ./database/backup.sh pre-restore)
#
#  Détecte automatiquement Docker (conteneur kidora-postgres) ou local
#  (psql + DATABASE_URL / PG*).
#
#  Windows : exécuter depuis Git Bash ou WSL.
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="${POSTGRES_CONTAINER:-kidora-postgres}"
PGUSER="${PGUSER:-kidora}"
PGDB="${PGDB:-kidora}"

if [ $# -lt 1 ]; then
  echo "Usage : $0 <fichier.sql.gz>"
  echo "Fichiers disponibles :"
  ls -1 "$SCRIPT_DIR/backups"/*.sql.gz 2>/dev/null || echo "  (aucun)"
  exit 1
fi

DUMP_FILE="$1"
if [ ! -f "$DUMP_FILE" ]; then
  echo "❌ Fichier introuvable : $DUMP_FILE"
  exit 1
fi

echo "⚠️  Restauration de KIDORA depuis : $DUMP_FILE"
echo "    La base « $PGDB » va être RECRÉÉE. Toutes les données actuelles seront remplacées."
read -r -p "    Tape OUI pour confirmer : " CONFIRM
if [ "$CONFIRM" != "OUI" ]; then
  echo "Annulé."
  exit 0
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
  echo "🔁 Mode Docker ($CONTAINER)…"
  docker exec "$CONTAINER" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS $PGDB;" \
    -c "CREATE DATABASE $PGDB OWNER $PGUSER;"
  gunzip -c "$DUMP_FILE" | docker exec -i "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1 > /dev/null
  TABLE_COUNT="$(docker exec "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
else
  echo "🔁 Mode local (psql)…"
  if [ -n "${DATABASE_URL:-}" ]; then
    PSQL=(psql "$DATABASE_URL")
  else
    PSQL=(psql -U "$PGUSER" -d "$PGDB")
  fi
  # Recrée la base (via postgres pour éviter de la supprimer « depuis l'intérieur »)
  if [ -n "${DATABASE_URL:-}" ]; then
    ADMIN_URL="${DATABASE_URL%/*}/postgres"
    psql "$ADMIN_URL" -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS $PGDB;" \
      -c "CREATE DATABASE $PGDB;"
    "${PSQL[@]}" -v ON_ERROR_STOP=1 > /dev/null < <(gunzip -c "$DUMP_FILE")
  else
    psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS $PGDB;" \
      -c "CREATE DATABASE $PGDB OWNER $PGUSER;"
    gunzip -c "$DUMP_FILE" | psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1 > /dev/null
  fi
  TABLE_COUNT="$("${PSQL[@]}" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
fi

echo "✅ Restauration terminée — $TABLE_COUNT tables présentes."
echo "   Vérifie ensuite : curl -fsS http://localhost/api/health"
echo "   Puis redémarre l'API si besoin : docker compose restart backend"

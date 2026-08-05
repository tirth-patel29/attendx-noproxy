#!/usr/bin/env bash
# ============================================================
# attendance-gateway backup script
# Dumps the Supabase Postgres (attendance DB) and copies a
# ROTATING set of dumps to the 500GB WD for power-cut safety.
#
# Usage:
#   scripts/backup.sh
#
# Cron (as the docker user) — 02:30 daily:
#   30 2 * * * /workspace/attendance-gateway/scripts/backup.sh >> /var/log/attendance-backup.log 2>&1
#
# Requirements: docker CLI available to this user, pg_dump inside the db container.
# ============================================================
set -euo pipefail

# --- Config (override via env if needed) ---
BACKUP_DIR="${BACKUP_DIR:-/mnt/wd/attendance-backups}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
KEEP_DAILY="${KEEP_DAILY:-7}"    # number of daily dumps to keep
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"  # number of weekly dumps to keep

STAMP="$(date +%Y%m%d_%H%M)"
mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

# --- 1. Dump inside the container, stream out — no extra disk on the box ---
echo "[$(date -Is)] Dumping ${DB_NAME} from ${DB_CONTAINER}..."
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -Fc "${DB_NAME}" \
  > "${BACKUP_DIR}/daily/attendance_${STAMP}.dump"

# --- 2. Also write a copy as the "current" baseline (easy restore target) ---
cp "${BACKUP_DIR}/daily/attendance_${STAMP}.dump" "${BACKUP_DIR}/attendance_current.dump"

# --- 3. Rotate daily (keep newest N) ---
ls -1t "${BACKUP_DIR}"/daily/attendance_*.dump 2>/dev/null \
  | tail -n +$((KEEP_DAILY + 1)) | xargs -r rm -f --

# --- 4. Promote Sunday/Monday dump to a weekly (keep newest N) ---
WEEKDAY="$(date +%u)"
if [ "${WEEKDAY}" = "1" ]; then   # Monday => weekly snapshot
  cp "${BACKUP_DIR}/daily/attendance_${STAMP}.dump" \
     "${BACKUP_DIR}/weekly/attendance_week_${STAMP}.dump"
  ls -1t "${BACKUP_DIR}"/weekly/attendance_week_*.dump 2>/dev/null \
    | tail -n +$((KEEP_WEEKLY + 1)) | xargs -r rm -f --
fi

# --- 5. Report ---
echo "[$(date -Is)] Backups OK: ${BACKUP_DIR}"
ls -lh "${BACKUP_DIR}/daily" | tail -5

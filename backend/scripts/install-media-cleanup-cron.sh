#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
LOG_FILE="${MEDIA_CLEANUP_CRON_LOG:-$PROJECT_ROOT/backend/logs/media-cleanup-cron.log}"
SCHEDULE="${MEDIA_CLEANUP_CRON_SCHEDULE:-20 3 * * *}"
DAYS="${MEDIA_CLEANUP_OLDER_THAN_DAYS:-30}"
PREFIX="${MEDIA_CLEANUP_PREFIX:-uploads/images/}"

mkdir -p "$(dirname "$LOG_FILE")"

CRON_CMD="cd $BACKEND_DIR && npm run cleanup:uploads -- --apply --days=$DAYS --prefix=$PREFIX >> $LOG_FILE 2>&1"
CRON_LINE="$SCHEDULE $CRON_CMD"

CURRENT_CRON="$(crontab -l 2>/dev/null || true)"
if echo "$CURRENT_CRON" | grep -Fq "$CRON_CMD"; then
  echo "Cron entry already exists."
  exit 0
fi

{
  echo "$CURRENT_CRON"
  echo "$CRON_LINE"
} | crontab -

echo "Installed daily media cleanup cron:"
echo "$CRON_LINE"

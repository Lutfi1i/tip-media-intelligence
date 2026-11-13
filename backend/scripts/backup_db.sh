#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +"%Y%m%d_%H%M%S")
OUT_FILE="/tmp/tip_media_${STAMP}.sql.gz"
pg_dump "${DATABASE_URL}" | gzip > "${OUT_FILE}"
echo "Backup created: ${OUT_FILE}"

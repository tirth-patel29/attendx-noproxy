#!/usr/bin/env bash
# ============================================================================
# Build ALL docker images from this repo — portable (no homelab assumptions).
#   ./scripts/build-all.sh            -> uses the root docker-compose.yml
#   CACHE_BUST=$(date +%s) ./scripts/build-all.sh
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
export CACHE_BUST="${CACHE_BUST:-$(date +%s)}"

echo "▶ Backend"
docker build --build-arg CACHE_BUST="$CACHE_BUST" -t attendance-backend:latest ./backend

echo "▶ Portal"
docker build --build-arg CACHE_BUST="$CACHE_BUST" -t attendance-portal:latest ./portal

echo "▶ Admin"
docker build --build-arg CACHE_BUST="$CACHE_BUST" -t attendance-admin:latest ./admin

echo "✔ All images built: attendance-backend, attendance-portal, attendance-admin"
docker images | grep -E "attendance-(backend|portal|admin)" | head
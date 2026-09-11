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

echo "▶ Teacher"
docker build --build-arg CACHE_BUST="$CACHE_BUST" -t attendance-teacher:latest ./teacher

echo "▶ Admin"
docker build --build-arg CACHE_BUST="$CACHE_BUST" -t attendance-admin:latest ./admin

echo "✔ All images built: attendance-backend, attendance-teacher, attendance-admin"
docker images | grep -E "attendance-(backend|teacher|admin)" | head
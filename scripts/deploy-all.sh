#!/usr/bin/env bash
# ============================================================================
# Deploy/update ALL apps on the homelab (or any ssh host running the same
# stack layout). Usage:
#
#   SSH_HOST=hetp@192.168.0.108 ./scripts/deploy-all.sh
#   SSH_HOST=user@server SSH_KEY=~/.ssh/id_ed25519 ./scripts/deploy-all.sh
#
# This is the "code → build image → update container" cycle: each stack dir on
# the host contains the app source + a docker-compose.yml; we rsync the changed
# source over, then rebuild + recreate the container.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

SSH_HOST="${SSH_HOST:?set SSH_HOST, e.g. hetp@192.168.0.108}"
SSH_KEY="${SSH_KEY:-}"
HOST_STACKS="${HOST_STACKS:-/home/hetp/docker-stacks}"

SSH_ARGS=()
[ -n "$SSH_KEY" ] && SSH_ARGS=(-i "$SSH_KEY")
# expand a leading ~ in SSH_KEY to the real home (works for CI runners too)
if [[ "$SSH_KEY" == \~* ]]; then SSH_KEY="${SSH_KEY/#\~/$HOME}"; SSH_ARGS=(-i "$SSH_KEY"); fi
RSYNC_SSH=ssh
[ -n "$SSH_KEY" ] && RSYNC_SSH="ssh -i $SSH_KEY"

deploy_app() {
  local local_src="$1" host_dir="$2"
  echo "▶ Syncing $local_src -> $SSH_HOST:$host_dir"
  rsync -az --exclude node_modules --exclude dist --exclude .git --exclude .dart_tool \
    -e "$RSYNC_SSH" "$local_src"/ "$SSH_HOST:$host_dir"/
  echo "▶ Rebuilding $host_dir"
  ssh "${SSH_ARGS[@]}" "$SSH_HOST" "cd '$host_dir' && CACHE_BUST=\$(date +%s) docker compose up -d --build"
}

deploy_app backend   "$HOST_STACKS/attendance-backend"
deploy_app portal    "$HOST_STACKS/attendance-portal/portal"
deploy_app admin     "$HOST_STACKS/attendance-admin/admin"

echo "✔ Deployed. Verifying:"
ssh "${SSH_ARGS[@]}" "$SSH_HOST" 'docker ps --filter name=attendance- --format "{{.Names}}  {{.Status}}"'
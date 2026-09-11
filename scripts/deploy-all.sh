#!/usr/bin/env bash
# ============================================================================
# Deploy/update ALL apps on the homelab - simplified version using git pull
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

SSH_HOST="${SSH_HOST:?set SSH_HOST, e.g. hetp@192.168.0.108}"
SSH_KEY="${SSH_KEY:-}"
HOST_STACKS="${HOST_STACKS:-/home/hetp/docker-stacks}"

SSH_ARGS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)
[ -n "$SSH_KEY" ] && SSH_ARGS+=(-i "$SSH_KEY")
if [[ "$SSH_KEY" == \~* ]]; then SSH_KEY="${SSH_KEY/#\~/$HOME}"; SSH_ARGS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i "$SSH_KEY"); fi

echo "▶ Pulling latest code on server..."
ssh "${SSH_ARGS[@]}" "$SSH_HOST" "cd /home/hetp/attendance-gateway && git pull origin main"

echo "▶ Syncing backend..."
ssh "${SSH_ARGS[@]}" "$SSH_HOST" "cp -r /home/hetp/attendance-gateway/backend/* $HOST_STACKS/attendance-backend/ && cp /home/hetp/attendance-gateway/backend/.dockerignore $HOST_STACKS/attendance-backend/ 2>/dev/null || true"

echo "▶ Syncing teacher..."
ssh "${SSH_ARGS[@]}" "$SSH_HOST" "cp -r /home/hetp/attendance-gateway/teacher/* $HOST_STACKS/attendance-teacher/teacher/ && cp /home/hetp/attendance-gateway/teacher/.dockerignore $HOST_STACKS/attendance-teacher/teacher/ 2>/dev/null || true"

echo "▶ Syncing admin..."
ssh "${SSH_ARGS[@]}" "$SSH_HOST" "cp -r /home/hetp/attendance-gateway/admin/* $HOST_STACKS/attendance-admin/admin/ && cp /home/hetp/attendance-gateway/admin/.dockerignore $HOST_STACKS/attendance-admin/admin/ 2>/dev/null || true"

echo "▶ Rebuilding backend..."
ssh "${SSH_ARGS[@]}" "$SSH_HOST" "cd $HOST_STACKS/attendance-backend && CACHE_BUST=\$(date +%s) docker compose up -d --build"

echo "▶ Rebuilding teacher..."
ssh "${SSH_ARGS[@]}" "$SSH_HOST" "cd $HOST_STACKS/attendance-teacher && CACHE_BUST=\$(date +%s) docker compose up -d --build"

echo "▶ Rebuilding admin..."
ssh "${SSH_ARGS[@]}" "$SSH_HOST" "cd $HOST_STACKS/attendance-admin && CACHE_BUST=\$(date +%s) docker compose up -d --build"

echo "✔ Deployed. Verifying:"
ssh "${SSH_ARGS[@]}" "$SSH_HOST" 'docker ps --filter name=attendance- --format "{{.Names}}  {{.Status}}"'
#!/usr/bin/env bash
set -euo pipefail

# Run on the EC2 host as ubuntu:
#   bash bootstrap-ec2.sh 13.205.215.53
#
# This uses sslip.io so it does not require creating DNS records. Replace it
# with your own domain later if desired.

PUBLIC_IP="${1:?Usage: bash bootstrap-ec2.sh <public-ec2-ip>}"
STACK_DIR="/home/ubuntu/stacks/gitnexus"
REPO_PATH="/home/ubuntu/attendance-gateway"
UI_HOST="gitnexus.${PUBLIC_IP}.sslip.io"
MCP_HOST="gitnexus-mcp.${PUBLIC_IP}.sslip.io"
CADDYFILE="/home/ubuntu/Caddyfile"
MARKER="# --- AttendX GitNexus ---"

command -v caddy >/dev/null
command -v docker >/dev/null
test -f "${STACK_DIR}/docker-compose.yml"
test -d "${REPO_PATH}/.git"

umask 077
MCP_TOKEN="$(openssl rand -hex 32)"
UI_PASSWORD="$(openssl rand -hex 20)"
UI_PASSWORD_HASH="$(caddy hash-password --plaintext "${UI_PASSWORD}")"

printf '%s\n' \
  "ATTENDX_REPO_PATH=${REPO_PATH}" \
  'GITNEXUS_PORT=4747' \
  'GITNEXUS_WEB_PORT=4173' \
  "GITNEXUS_PUBLIC_URL=https://${UI_HOST}" \
  "GITNEXUS_MCP_AUTH_TOKEN=${MCP_TOKEN}" \
  > "${STACK_DIR}/.env"

printf '%s\n' \
  "GitNexus UI: https://${UI_HOST}" \
  'GitNexus UI user: attendx' \
  "GitNexus UI password: ${UI_PASSWORD}" \
  "GitNexus MCP: https://${MCP_HOST}/api/mcp" \
  "GitNexus MCP bearer token: ${MCP_TOKEN}" \
  > "${STACK_DIR}/CREDENTIALS.txt"

if ! grep -Fq "${MARKER}" "${CADDYFILE}"; then
  cp "${CADDYFILE}" "${CADDYFILE}.before-gitnexus"
  {
    printf '\n%s\n' "${MARKER}"
    printf 'https://%s {\n' "${UI_HOST}"
    printf '    basic_auth {\n        attendx %s\n    }\n' "${UI_PASSWORD_HASH}"
    printf '    handle /api/* {\n        reverse_proxy 127.0.0.1:4747\n    }\n    handle {\n        reverse_proxy 127.0.0.1:4173\n    }\n}\n\n'
    printf 'https://%s {\n' "${MCP_HOST}"
    printf '    @authorized {\n        path /api/mcp*\n        header Authorization "Bearer %s"\n    }\n' "${MCP_TOKEN}"
    printf '    handle @authorized {\n        reverse_proxy 127.0.0.1:4747\n    }\n'
    printf '    handle {\n        respond "Not found" 404\n    }\n}\n'
  } >> "${CADDYFILE}"
fi

caddy fmt --overwrite "${CADDYFILE}"
caddy validate --config "${CADDYFILE}"
sudo systemctl reload caddy

cd "${STACK_DIR}"
docker compose up -d
docker compose exec gitnexus gitnexus analyze /workspace/attendx
docker compose ps

echo
echo "Deployment complete. Read ${STACK_DIR}/CREDENTIALS.txt and store it securely."

#!/usr/bin/env bash
# ============================================================================
# publish-gitea-release.sh — upload an existing built APK as a Gitea release.
#
# Env:
#   GITEA_URL   API base  (default http://gitea:3000/api/v1 ; use
#                          http://git.atmyhome.tech/api/v1 outside the network)
#   GITEA_TOKEN a token with write:repository (repo/org secret in CI)
#   OWNER       default het
#   REPO        default attendance-gateway
#   TAG         default v1.0.0
#   APK         default build/app/outputs/flutter-apk/app-release.apk
#
# Prints the direct download URL of the uploaded asset on success.
# ============================================================================
set -euo pipefail

API="${GITEA_URL:-http://gitea:3000/api/v1}"
TOKEN="${GITEA_TOKEN:?set GITEA_TOKEN}"
OWNER="${OWNER:-het}"
REPO="${REPO:-attendance-gateway}"
TAG="${TAG:-v1.0.0}"
APK="${APK:-build/app/outputs/flutter-apk/app-release.apk}"
TITLE="${TITLE:-Zero-Trust Student Client ${TAG#v}}"

[ -f "$APK" ] || { echo "APK not found at $APK (run the flutter build first)"; exit 1; }
NAME="$(basename "$APK")"

echo "▶ Creating release tag=$TAG ..."
R=$(curl -fsS -X POST "$API/repos/$OWNER/$REPO/releases" \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"tag_name\":\"$TAG\",\"target_commitish\":\"main\",\"name\":\"$TITLE\",\"body\":\"Zero-Trust Cryptographic Student Attendance Gateway - Android client release.\",\"draft\":false,\"prerelease\":false}")
RID=$(printf '%s' "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "  release id=$RID"

echo "▶ Uploading $APK ..."
A=$(curl -fsS -X POST "$API/repos/$OWNER/$REPO/releases/$RID/assets?name=$NAME" \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@$APK")

URLS=$(printf '%s' "$A" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('browser_download_url') or ('%s/repos/%s/%s/releases/download/%s/%s'%('${API%/api/v1}','$OWNER','$REPO','$TAG','$NAME')))")
echo "✔ Released"
echo "$URLS"
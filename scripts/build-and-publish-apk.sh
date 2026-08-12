#!/usr/bin/env bash
# ============================================================================
# build-and-publish-apk.sh — the full Flutter release pipeline in one command.
#
#   cd attendance-gateway
#   GITEA_TOKEN=<token> ./scripts/build-and-publish-apk.sh
#
# Steps: android_fix (biometric + memory guard) -> flutter clean/pub get ->
#        flutter build apk --release -> publish-gitea-release
# Env: GITEA_URL, GITEA_TOKEN, OWNER, REPO, TAG, API_BASE_URL (dart-define).
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/../app"

echo "⚠ Requires Android toolchain: Flutter SDK + Android SDK/JDK."

bash ../scripts/android_fix.sh

echo "▶ flutter clean"
flutter clean

echo "▶ flutter pub get"
flutter pub get

API_BASE_URL="${API_BASE_URL:-https://api.atmyhome.tech}"
API_KEY="${API_KEY:-}"
if [ -n "$API_KEY" ]; then API_KEY_DEFINE="--dart-define=API_KEY=$API_KEY"; else API_KEY_DEFINE=""; fi

echo "▶ flutter build apk --release (API=$API_BASE_URL, key=${API_KEY:+(embedded)})"
flutter build apk --release --dart-define=API_BASE_URL="$API_BASE_URL" $API_KEY_DEFINE

APK="build/app/outputs/flutter-apk/app-release.apk"
[ -f "$APK" ] || { echo "❌ artifact missing: $APK"; exit 1; }
echo "✅ built: $APK ($(du -h "$APK" | cut -f1))"

echo ""
echo "▶ Publishing to Gitea releases ..."
cd ..
bash scripts/publish-gitea-release.sh
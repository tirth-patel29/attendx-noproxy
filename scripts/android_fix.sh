#!/usr/bin/env bash
# ============================================================================
# android_fix.sh — idempotent Android platform fixes required before release.
#
# 1. Ensure android/ exists (flutter create . if missing).
# 2. local_auth biometric fix: MainActivity must extend FlutterFragmentActivity
#    (plain FlutterActivity throws and the fingerprint prompt never appears).
# 3. AndroidManifest: declare USE_BIOMETRIC + USE_FINGERPRINT.
# 4. gradle.properties: cap JVM heap (-Xmx2048m) to avoid host OOM thrash.
#
# Run from the app/ directory (or pass APP_DIR).
# ============================================================================
set -euo pipefail
cd "${APP_DIR:-$(dirname "$0")/../app}"

echo "▶ android/ present?"
if [ ! -d android ]; then
  echo "  missing -> flutter create ."
  flutter create .
else
  echo "  ok"
fi

MANIFEST="android/app/src/main/AndroidManifest.xml"
[ -f "$MANIFEST" ] || { echo "  manifest not found at $MANIFEST"; exit 1; }

echo "▶ MainActivity -> FlutterFragmentActivity"
MAIN_ACT=$(find android -name MainActivity.kt | head -1)
[ -z "$MAIN_ACT" ] && { echo "  MainActivity.kt not found"; exit 1; }
if grep -q 'FlutterFragmentActivity' "$MAIN_ACT"; then
  echo "  already fixed"
else
  sed -i 's#io.flutter.embedding.android.FlutterActivity#io.flutter.embedding.android.FlutterFragmentActivity#g; s/class MainActivity : FlutterActivity()/class MainActivity : FlutterFragmentActivity()/' "$MAIN_ACT"
  echo "  patched $MAIN_ACT"
fi

echo "▶ permissions (USE_BIOMETRIC / USE_FINGERPRINT)"
if ! grep -q 'android.permission.USE_BIOMETRIC' "$MANIFEST"; then
  sed -i 's#<manifest[^>]*>#&\n    <uses-permission android:name="android.permission.USE_BIOMETRIC"/>\n    <uses-permission android:name="android.permission.USE_FINGERPRINT"/>#' "$MANIFEST"
  echo "  added"
else
  echo "  already present"
fi

echo "▶ gradle.properties JVM memory guard"
GP="android/gradle.properties"
[ -f "$GP" ] || { echo "org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8" > "$GP"; echo "  created $GP"; }
grep -q 'org.gradle.jvmargs.*-Xmx2048m' "$GP" || {
  { grep -v '^org.gradle.jvmargs' "$GP" || true; echo "org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8"; } > "$GP.tmp"
  mv "$GP.tmp" "$GP"; echo "  set Xmx2048m";
}

echo "✔ Android platform ready: biometric (FlutterFragmentActivity + USE_BIOMETRIC) & memory guard set."

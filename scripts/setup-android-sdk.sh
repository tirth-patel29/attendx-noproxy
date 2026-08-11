#!/usr/bin/env bash
# ============================================================================
# setup-android-sdk.sh — headless Android/Flutter build toolchain (no root).
# Installs into $TOOLCHAIN_DIR (default ~/toolchain) and appends env exports
# to ~/.bashrc. Idempotent: already-installed components are skipped.
#
#   OpenJDK 17 (Temurin) + Android cmdline-tools (build-tools;34.0.0,
#   platforms;android-34, platform-tools) + Flutter SDK (latest stable).
# ============================================================================
set -euo pipefail

TOOLCHAIN_DIR="${TOOLCHAIN_DIR:-$HOME/toolchain}"
mkdir -p "$TOOLCHAIN_DIR"
cd "$TOOLCHAIN_DIR"

export JAVA_HOME="$TOOLCHAIN_DIR/jdk"
export ANDROID_HOME="$TOOLCHAIN_DIR/android"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$TOOLCHAIN_DIR/flutter/bin:$PATH"

echo "==> [1/4] OpenJDK 17 (Temurin)"
if [ ! -x "$JAVA_HOME/bin/java" ]; then
  curl -fsSL -o jdk.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
  rm -rf jdk && mkdir jdk
  tar -xzf jdk.tar.gz -C jdk --strip-components=1
  rm -f jdk.tar.gz
else
  echo "    already installed"
fi
"$JAVA_HOME/bin/java" -version 2>&1 | head -1

echo "==> [2/4] Android cmdline-tools + SDK 34"
if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  [ -f cmdtools.zip ] || curl -fsSL -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  # no `unzip` on this host -> use python3's zipfile
  python3 - "$ANDROID_HOME/cmdline-tools" <<'PY'
import sys, zipfile
zipfile.ZipFile("cmdtools.zip").extractall(sys.argv[1])
PY
  mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  # python zipfile doesn't preserve exec bits -> make the tools executable
  chmod -R u+x "$ANDROID_HOME/cmdline-tools/latest/bin"
  rm -f cmdtools.zip
fi
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager --install "platform-tools" "platforms;android-34" "build-tools;34.0.0" >/dev/null
echo "    sdkmanager ready: $(sdkmanager --list_installed 2>/dev/null | grep -c 'platforms\|build-tools\|platform-tools') packages"

echo "==> [3/4] Flutter SDK (latest stable)"
if [ ! -x "$TOOLCHAIN_DIR/flutter/bin/flutter" ]; then
  ARCHIVE=$(curl -fsSL "https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);s=[r for r in d['releases'] if r['channel']=='stable'][0];print(s['archive'])")
  echo "    downloading $ARCHIVE"
  curl -fsSL -o flutter.tar.xz "https://storage.googleapis.com/flutter_infra_release/releases/$ARCHIVE"
  tar -xf flutter.tar.xz
  rm -f flutter.tar.xz
else
  echo "    already installed"
fi
git -C "$TOOLCHAIN_DIR/flutter" pull --ff-only -q >/dev/null 2>&1 || true
export PATH="$TOOLCHAIN_DIR/flutter/bin:$PATH"

echo "==> [4/4] Persist env in ~/.bashrc"
RC="$HOME/.bashrc"
for line in \
  "export TOOLCHAIN_DIR=\"$TOOLCHAIN_DIR\"" \
  "export JAVA_HOME=\"$TOOLCHAIN_DIR/jdk\"" \
  "export ANDROID_HOME=\"$TOOLCHAIN_DIR/android\"" \
  "export ANDROID_SDK_ROOT=\"$ANDROID_HOME\"" \
  "export PATH=\"$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$TOOLCHAIN_DIR/flutter/bin:\$PATH\""; do
  grep -qF "$line" "$RC" || echo "$line" >> "$RC"
done

echo ""
echo "✔ Toolchain installed. Verify with:"
echo "    source ~/.bashrc && flutter doctor -v"
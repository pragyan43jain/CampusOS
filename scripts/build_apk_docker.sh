#!/bin/bash
set -e

# CampusOS - Local Docker Android APK Builder
# Compiles the Android native APK inside a container without needing Android Studio installed locally.

echo "========================================="
echo "   CampusOS Local Docker APK Builder    "
echo "========================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "1. Generating Android launcher and splash assets..."
python3 "$PROJECT_DIR/scripts/generate_android_icons.py"

echo "2. Building frontend production assets..."
cd "$PROJECT_DIR/frontend"
npm run build

echo "3. Syncing Capacitor Android assets..."
npx cap sync android

echo "4. Ensuring Android build container image is ready..."
if ! docker image inspect campusos-android-builder:latest >/dev/null 2>&1; then
  echo "Building lightweight Android SDK container (JDK 17 + SDK 34)..."
  docker build -t campusos-android-builder:latest -f "$PROJECT_DIR/scripts/Dockerfile.android" "$PROJECT_DIR/scripts"
fi

echo "5. Compiling Android APK with Gradle..."
docker run --rm \
  -v "$PROJECT_DIR/frontend":/workspace \
  -v "$HOME/.gradle":/root/.gradle \
  -w /workspace/android \
  campusos-android-builder:latest \
  bash -c "chmod +x gradlew && ./gradlew assembleDebug --no-daemon --stacktrace"

APK_PATH="$PROJECT_DIR/frontend/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
  APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
  echo ""
  echo "============================================================"
  echo " SUCCESS! CampusOS Android APK generated successfully!     "
  echo " Location: $APK_PATH"
  echo " Size:     $APK_SIZE"
  echo " Target:   com.campusos.app"
  echo "============================================================"
else
  echo "Error: Build finished but APK was not found at $APK_PATH"
  exit 1
fi

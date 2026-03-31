#!/usr/bin/env bash
# Build, ad-hoc sign, and package Claude Session Manager for distribution.
# Ad-hoc signing changes the macOS error from "damaged" → "unidentified developer"
# which shows an "Open Anyway" button in System Settings — no Terminal needed.

set -e

APP_NAME="Claude Session Manager"
BUNDLE_DIR="src-tauri/target/release/bundle"
APP_PATH="$BUNDLE_DIR/macos/$APP_NAME.app"
VERSION=$(node -p "require('./package.json').version")
DMG_OUT="$BUNDLE_DIR/dmg/${APP_NAME}_${VERSION}_aarch64.dmg"
SIGNED_ZIP="$BUNDLE_DIR/dmg/${APP_NAME}_${VERSION}_aarch64_signed.zip"

echo "▶ Building v$VERSION..."
npm run tauri build

echo "▶ Ad-hoc signing .app..."
codesign --force --deep --sign - "$APP_PATH"

echo "▶ Verifying signature..."
codesign --verify --verbose "$APP_PATH" && echo "✓ Signature valid"

echo "▶ Creating signed .zip for distribution..."
cd "$(dirname "$APP_PATH")"
zip -qr "$(cd - > /dev/null && pwd)/$SIGNED_ZIP" "$APP_NAME.app"
cd - > /dev/null

echo ""
echo "✅ Done!"
echo "   DMG (unsigned): $DMG_OUT"
echo "   ZIP (ad-hoc signed): $SIGNED_ZIP"
echo ""
echo "📦 Use the signed ZIP for sharing with colleagues."
echo "   They'll see 'unidentified developer' → right-click Open or"
echo "   System Settings → Privacy & Security → Open Anyway"

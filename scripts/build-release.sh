#!/usr/bin/env bash
# Build and package Claude Session Manager.
# Produces two artifacts:
#   1. _installer.dmg  — DMG with 설치하기.command (더블클릭으로 설치, no Terminal needed)
#   2. _signed.zip     — Ad-hoc signed ZIP (System Settings → Open Anyway)

set -e

APP_NAME="Claude Session Manager"
BUNDLE_DIR="src-tauri/target/release/bundle"
APP_PATH="$BUNDLE_DIR/macos/$APP_NAME.app"
VERSION=$(node -p "require('./package.json').version")
OUT_DIR="$BUNDLE_DIR/dmg"
INSTALLER_DMG="$OUT_DIR/${APP_NAME}_${VERSION}_aarch64_installer.dmg"
SIGNED_ZIP="$OUT_DIR/${APP_NAME}_${VERSION}_aarch64_signed.zip"

echo "▶ Building v$VERSION..."
npm run tauri build

# ── 1. Installer DMG (설치하기.command 포함) ───────────────────────────────
echo "▶ Creating installer DMG with 설치하기.command..."
TMPDIR=$(mktemp -d)

# cp -r strips extended attributes (no quarantine on destination)
cp -r "$APP_PATH" "$TMPDIR/$APP_NAME.app"
cp "scripts/설치하기.command" "$TMPDIR/설치하기.command"
chmod +x "$TMPDIR/설치하기.command"

hdiutil create \
  -volname "$APP_NAME $VERSION" \
  -srcfolder "$TMPDIR" \
  -ov -format UDZO \
  "$INSTALLER_DMG" > /dev/null

rm -rf "$TMPDIR"
echo "✓ Installer DMG: $INSTALLER_DMG"

# ── 2. Ad-hoc signed ZIP (백업용) ─────────────────────────────────────────
echo "▶ Ad-hoc signing .app..."
codesign --force --deep --sign - "$APP_PATH"
codesign --verify --verbose "$APP_PATH" 2>&1 | grep -q "satisfies" && echo "✓ Signature valid"

echo "▶ Creating signed ZIP..."
cd "$(dirname "$APP_PATH")"
zip -qr "$(cd - > /dev/null && pwd)/$SIGNED_ZIP" "$APP_NAME.app"
cd - > /dev/null
echo "✓ Signed ZIP: $SIGNED_ZIP"

echo ""
echo "✅ Done! v$VERSION"
echo ""
echo "📦 동료 공유 권장:"
echo "   → $INSTALLER_DMG"
echo "      DMG 열기 → '설치하기.command' 더블클릭 → 자동 설치"
echo ""
echo "   → $SIGNED_ZIP (대안)"
echo "      시스템 설정 → 개인 정보 보호 및 보안 → 그래도 열기"

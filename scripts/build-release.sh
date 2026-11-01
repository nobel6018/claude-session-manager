#!/usr/bin/env bash
# Build and package Claude Session Manager.
# Produces:
#   1. _installer.dmg  — DMG with 설치하기.command (더블클릭으로 설치, no Terminal needed)
#   2. _signed.zip     — Ad-hoc signed ZIP (System Settings → Open Anyway)
#   3. 앱 안 업데이트 파일: .app.tar.gz 와 latest.json (GitHub Release에 함께 올린다)
# @see docs/update.md

set -e

APP_NAME="Claude Session Manager"
BUNDLE_DIR="src-tauri/target/release/bundle"
APP_PATH="$BUNDLE_DIR/macos/$APP_NAME.app"
VERSION=$(node -p "require('./package.json').version")
OUT_DIR="$BUNDLE_DIR/dmg"
INSTALLER_DMG="$OUT_DIR/${APP_NAME}_${VERSION}_aarch64_installer.dmg"
SIGNED_ZIP="$OUT_DIR/${APP_NAME}_${VERSION}_aarch64_signed.zip"

UPDATER_DIR="$OUT_DIR/updater"
REPO="nobel6018/claude-session-manager"
# GitHub은 올린 파일 이름의 공백을 점으로 바꾼다. latest.json의 URL과 맞추려고 처음부터 점으로 짓는다
UPDATE_TARBALL="Claude.Session.Manager_${VERSION}_aarch64.app.tar.gz"

# createUpdaterArtifacts가 켜져 있어 서명 키가 없으면 tauri build가 실패한다
if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/claude-session-manager-updater.key)"
fi
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

echo "▶ Building v$VERSION..."
npm run tauri build

# ── 0. 앱 안 업데이트 파일 ─────────────────────────────────────────────────
# codesign 전의 .app으로 만든 tar.gz다. tauri build가 만든 그대로 올린다
echo "▶ Writing updater latest.json..."
rm -rf "$UPDATER_DIR" && mkdir -p "$UPDATER_DIR"
cp "$BUNDLE_DIR/macos/$APP_NAME.app.tar.gz" "$UPDATER_DIR/$UPDATE_TARBALL"
jq -n \
  --arg v "$VERSION" \
  --arg sig "$(cat "$BUNDLE_DIR/macos/$APP_NAME.app.tar.gz.sig")" \
  --arg url "https://github.com/$REPO/releases/download/v$VERSION/$UPDATE_TARBALL" \
  --arg notes "https://github.com/$REPO/releases/tag/v$VERSION" \
  --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{version: $v, notes: $notes, pub_date: $date, platforms: {"darwin-aarch64": {signature: $sig, url: $url}}}' \
  > "$UPDATER_DIR/latest.json"
echo "✓ Updater: $UPDATER_DIR"

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
cat <<EOF_RELEASE
🚀 Release (DMG + 앱 안 업데이트 파일):
   gh release create v$VERSION \\
     "$OUT_DIR/${APP_NAME}_${VERSION}_aarch64.dmg" \\
     "$UPDATER_DIR/$UPDATE_TARBALL" "$UPDATER_DIR/latest.json" \\
     --repo $REPO --title "v$VERSION" --notes-file <노트 파일>
EOF_RELEASE
echo ""
echo "📦 동료 공유 권장:"
echo "   → $INSTALLER_DMG"
echo "      DMG 열기 → '설치하기.command' 더블클릭 → 자동 설치"
echo ""
echo "   → $SIGNED_ZIP (대안)"
echo "      시스템 설정 → 개인 정보 보호 및 보안 → 그래도 열기"

#!/usr/bin/env bash
# Claude Session Manager 설치 스크립트
# DMG에서 더블클릭하면 자동으로 /Applications에 설치됩니다.

APP_NAME="Claude Session Manager.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_SRC="$SCRIPT_DIR/$APP_NAME"
APP_DEST="/Applications/$APP_NAME"

echo ""
echo "======================================"
echo "  Claude Session Manager 설치 중..."
echo "======================================"
echo ""

# 기존 버전 교체
if [ -d "$APP_DEST" ]; then
  echo "⚠️  기존 버전을 교체합니다..."
  rm -rf "$APP_DEST"
fi

echo "📦 /Applications 폴더에 복사 중..."
cp -r "$APP_SRC" "$APP_DEST"

echo "🔓 macOS 보안 속성 제거 중..."
xattr -cr "$APP_DEST"

echo ""
echo "✅ 설치 완료! 앱을 실행합니다."
echo ""

open "$APP_DEST"

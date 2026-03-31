# Claude Session Manager — 프로젝트 가이드

## 프론트엔드 배포 (Vercel CDN)

- **URL**: https://claude-session-manager.vercel.app
- **방식**: 로컬 빌드 → prebuilt 배포 (소스 전체 업로드 안 함)
- Tauri 앱은 `frontendDist`로 이 URL을 로드 → UI 변경은 앱 재배포 없이 즉시 반영
- Rust 백엔드 변경 시에만 앱 재빌드 필요

### UI 변경 배포 방법
```bash
npm run build                               # dist/ 생성
rm -rf .vercel/output && mkdir -p .vercel/output/static
cp -r dist/* .vercel/output/static/
echo '{"version":3}' > .vercel/output/config.json
vercel deploy --prebuilt --yes --prod       # 254KB만 업로드, 수초 완료
git add -A && git commit && git push        # 코드도 함께 push
```

---

## 릴리즈 규칙

### 버전 관리
- 버전 파일 3곳을 항상 함께 올려야 한다:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`

### 빌드 & 배포
```bash
bash scripts/build-release.sh
```
- DMG + ad-hoc signed ZIP 모두 생성됨
- GitHub Release에는 DMG만 올린다 (`_installer.dmg`, `_signed.zip` 제외)

### Release Notes 필수 포함 내용
모든 릴리즈 노트 하단에 아래 설치 안내를 반드시 포함한다:

```markdown
---

## 설치 방법

DMG를 다운로드한 뒤 `Claude Session Manager.app`을 `/Applications`로 이동하세요.

### ⚠️ macOS Gatekeeper 경고 해결

처음 실행 시 "손상되었기 때문에 열 수 없습니다" 또는 "Not Opened" 경고가 뜨면, **터미널에서 아래 명령어를 실행**하세요:

\`\`\`
xattr -cr /Applications/Claude\ Session\ Manager.app
\`\`\`

이후 정상 실행됩니다.
```

### GitHub 계정
- 이 프로젝트(`~/leedo/`)는 항상 `nobel6018` 계정 사용
- 푸시/PR 전: `gh auth switch --user nobel6018`

## 기술 스택

- **Tauri v2** (Rust 백엔드) + **React** + **TypeScript** + **Tailwind CSS v4**
- 상태관리: Zustand
- DB: SQLite (rusqlite, 태그/북마크)
- 세션 파싱: Rust JSONL 스트리밍 파서

## 아키텍처 주요 포인트

- 세션 데이터는 인메모리 캐시(`OnceLock<Mutex<Option<SessionCache>>>`)에 보관 — 프로젝트 전환 시 필터링만
- 세션 삭제는 `.jsonl` → `.jsonl.deleted` 리네임 (복구 가능)
- 세션 재개: AppleScript로 iTerm2 새 탭 열고 `cd {cwd} && claude --resume {id}` 실행
- `/rename` 감지: JSONL의 `type: "system"` 메시지에서 `"Session renamed to:"` 파싱

## macOS 배포 한계

- Apple Developer 계정($99/yr) 없어서 공증(notarization) 불가
- 배포 시 Gatekeeper 경고 발생 → `xattr -cr` 명령어로 해결
- 자동 업데이트(`tauri-plugin-updater`)도 공증 없이는 macOS에서 동작 안 함

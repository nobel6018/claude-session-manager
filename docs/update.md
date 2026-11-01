# 앱 업데이트

Claude Session Manager는 두 층으로 업데이트됩니다.

| 층 | 방식 | 반영 시점 |
|---|---|---|
| UI | Vercel(`frontendDist`)에서 불러온다 | 배포 즉시. 앱에서 ⌘R |
| 앱(Rust) | Tauri updater로 앱 안에서 받아 설치 | 0.9.3부터. 0.9.2 이하는 한 번만 DMG로 직접 설치 |

## 동작

1. 앱을 켜거나 메뉴 "Check for Updates..."를 누르면 `releases/latest/download/latest.json`을 읽습니다
2. 새 버전이 있으면 배너에 "업데이트하고 다시 켜기" 버튼이 뜹니다. 저절로 설치하지 않습니다
3. 버튼을 누르면 받고, 앱에 박힌 공개 키로 서명을 확인한 뒤 `.app`을 바꾸고 다시 켭니다
4. 실패하면 배너에 이유와 릴리스 페이지 링크를 보여 줍니다. 다시 누르면 처음부터 받습니다(`install()`이 받은 바이트를 비우기 때문)

UI는 updater 플러그인이 없는 예전 앱에서도 불러와지므로, updater 확인이 실패하면 GitHub API로 새 버전만 확인해 "앱 다운로드" 버튼(릴리스 페이지)을 보여 줍니다. 그래서 UI를 먼저 배포해도 예전 앱이 깨지지 않습니다.

앱 안에서 받은 파일에는 macOS 격리 표시(`com.apple.quarantine`)가 붙지 않아, 업데이트 뒤에는 `xattr -cr`이 필요 없습니다.

## 서명

Apple 코드 서명과 별개인 Tauri updater 서명(minisign)입니다.

| 항목 | 위치 |
|---|---|
| 공개 키 | `src-tauri/tauri.conf.json` `plugins.updater.pubkey` |
| 비밀 키 | `~/.tauri/claude-session-manager-updater.key`(비밀번호 없음) |

비밀 키를 잃으면 설치된 앱에 업데이트를 보낼 수 없습니다. 새 키로 만든 앱을 사용자가 손으로 다시 설치해야 하니 따로 백업합니다.

## 릴리스

`bash scripts/build-release.sh`가 DMG와 함께 `bundle/dmg/updater/`에 아래 파일을 만들고, 올릴 `gh release create` 명령을 출력합니다.

| 파일 | 쓰임 |
|---|---|
| `Claude.Session.Manager_x.y.z_aarch64.app.tar.gz` | 업데이트 본체. GitHub이 공백을 점으로 바꾸므로 처음부터 점으로 짓는다 |
| `latest.json` | 버전, 위 파일 주소, 서명 |

`latest.json`이 Release에 없으면 앱은 "앱 다운로드" 안내로 돌아갑니다.

## 코드 위치

| 위치 | 내용 |
|---|---|
| `src/hooks/useUpdateChecker.ts` | `checkInstallable`, `install` |
| `src/components/UpdateBanner.tsx` | 배너 버튼과 진행률 |
| `src-tauri/src/lib.rs` | updater, process 플러그인 등록 |
| `src-tauri/capabilities/default.json`, `remote.json` | `updater:default`, `process:allow-restart`. UI가 Vercel이라 `remote.json`에도 있어야 한다 |
| `scripts/build-release.sh` | `latest.json` 생성 |

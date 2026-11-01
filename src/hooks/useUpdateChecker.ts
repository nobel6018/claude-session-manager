import { useEffect, useState, useCallback, useRef } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";

// 앱 업데이트 확인. 이 UI는 Vercel에서 불러오므로 updater 플러그인이 없는 예전 앱(0.9.2 이하)에서도 돈다.
// 그래서 updater(latest.json)로 먼저 확인하고, 실패하면 GitHub API로 확인해 다운로드 페이지로 안내한다.
// @see docs/update.md

const REPO = "nobel6018/claude-session-manager";
const META_URL = "https://claude-session-manager.vercel.app/meta.json";

export interface BackendUpdate {
  version: string;
  releaseUrl: string;
  /** 앱 안에서 받아 설치할 수 있으면 true. false면 다운로드 페이지로 안내한다 */
  installable: boolean;
}

/** 앱 안 설치 진행 상태 */
export type InstallPhase =
  | { kind: "idle" }
  | { kind: "downloading"; percent: number | null }
  | { kind: "installing" };

export interface FrontendStatus {
  current: string;     // 현재 로드된 git hash
  latest: string;      // Vercel에 배포된 최신 git hash
  isLatest: boolean;
}

export function useUpdateChecker() {
  const [backendUpdate, setBackendUpdate] = useState<BackendUpdate | null>(null);
  const [frontendStatus, setFrontendStatus] = useState<FrontendStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [showResult, setShowResult] = useState(false); // 수동 확인 결과 3초 표시
  const [currentBackendVersion, setCurrentBackendVersion] = useState("");
  const [phase, setPhase] = useState<InstallPhase>({ kind: "idle" });
  const [installError, setInstallError] = useState<string | null>(null);
  const installer = useRef<Update | null>(null);
  /** 받아 두었으면 다시 받지 않는다. install()이 받은 바이트를 비우므로 실패하면 false로 되돌린다 */
  const downloaded = useRef(false);

  const checkForUpdate = useCallback(async (manual = false) => {
    if (checking) return;
    setChecking(true);
    if (manual) setFrontendStatus(null);

    try {
      // ── 백엔드 버전 체크 (GitHub Releases) ──────────────────────────
      const appVersion = await getVersion();
      setCurrentBackendVersion(appVersion);

      const found = await checkInstallable();
      if (found !== "unavailable") {
        if (installer.current?.version !== found?.version) downloaded.current = false;
        installer.current = found;
        setBackendUpdate(found && {
          version: found.version,
          releaseUrl: `https://github.com/${REPO}/releases/tag/v${found.version}`,
          installable: true,
        });
      } else {
        const beRes = await fetch(
          `https://api.github.com/repos/${REPO}/releases/latest`,
          { headers: { Accept: "application/vnd.github+json" } }
        );
        if (beRes.ok) {
          const release = await beRes.json();
          const latest = (release.tag_name as string).replace(/^v/, "");
          if (isNewerVersion(latest, appVersion)) {
            setBackendUpdate({ version: latest, releaseUrl: release.html_url, installable: false });
          }
        }
      }

      // ── 프론트엔드 버전 체크 (Vercel meta.json) ──────────────────────
      const feRes = await fetch(META_URL, { cache: "no-store" });
      if (feRes.ok) {
        const meta: { gitHash: string } = await feRes.json();
        const current = __GIT_HASH__;
        setFrontendStatus({
          current,
          latest: meta.gitHash,
          isLatest: meta.gitHash === current,
        });
      }

      if (manual) {
        setShowResult(true);
        setTimeout(() => setShowResult(false), 5000);
      }
    } catch {
      // 네트워크 오류 무시
    } finally {
      setChecking(false);
    }
  }, [checking]);

  useEffect(() => {
    checkForUpdate(false);
    const unlisten = listen("check-for-updates", () => checkForUpdate(true));
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const install = useCallback(async () => {
    const target = installer.current;
    if (!target || phase.kind !== "idle") return;
    setInstallError(null);
    try {
      if (!downloaded.current) {
        let total: number | null = null;
        let received = 0;
        setPhase({ kind: "downloading", percent: null });
        await target.download((event) => {
          if (event.event === "Started") total = event.data.contentLength ?? null;
          if (event.event === "Progress") {
            received += event.data.chunkLength;
            if (total) setPhase({ kind: "downloading", percent: Math.min(100, Math.round((received / total) * 100)) });
          }
        });
        downloaded.current = true;
      }
      setPhase({ kind: "installing" });
      await target.install();
      await relaunch();
    } catch (e) {
      downloaded.current = false;
      setInstallError(String(e));
    } finally {
      setPhase({ kind: "idle" });
    }
  }, [phase.kind]);

  return {
    backendUpdate,
    phase,
    installError,
    install,
    frontendStatus,
    checking,
    showResult,
    currentBackendVersion,
    openReleasePage: (url: string) => openUrl(url),
    dismissBackend: () => setBackendUpdate(null),
  };
}

/**
 * updater(latest.json)로 확인한다. 새 버전이면 Update, 최신이면 null.
 * 플러그인이 없는 예전 앱, latest.json이 없는 릴리스, 오프라인이면 "unavailable"
 */
async function checkInstallable(): Promise<Update | null | "unavailable"> {
  try {
    return await check();
  } catch (e) {
    console.warn(`updater 확인 실패, GitHub API로 확인합니다: ${e}`);
    return "unavailable";
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [lMaj, lMin, lPatch] = parse(latest);
  const [cMaj, cMin, cPatch] = parse(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

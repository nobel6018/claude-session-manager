import { useEffect, useState, useCallback } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";

const REPO = "nobel6018/claude-session-manager";
const META_URL = "https://claude-session-manager.vercel.app/meta.json";

export interface BackendUpdate {
  version: string;
  releaseUrl: string;
}

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

  const checkForUpdate = useCallback(async (manual = false) => {
    if (checking) return;
    setChecking(true);
    if (manual) setFrontendStatus(null);

    try {
      // ── 백엔드 버전 체크 (GitHub Releases) ──────────────────────────
      const appVersion = await getVersion();
      setCurrentBackendVersion(appVersion);

      const beRes = await fetch(
        `https://api.github.com/repos/${REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (beRes.ok) {
        const release = await beRes.json();
        const latest = (release.tag_name as string).replace(/^v/, "");
        if (isNewerVersion(latest, appVersion)) {
          setBackendUpdate({ version: latest, releaseUrl: release.html_url });
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

  return {
    backendUpdate,
    frontendStatus,
    checking,
    showResult,
    currentBackendVersion,
    openReleasePage: (url: string) => openUrl(url),
    dismissBackend: () => setBackendUpdate(null),
  };
}

function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [lMaj, lMin, lPatch] = parse(latest);
  const [cMaj, cMin, cPatch] = parse(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

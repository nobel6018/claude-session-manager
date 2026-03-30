import { useEffect, useState, useCallback } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";

const REPO = "nobel6018/claude-session-manager";

export interface UpdateInfo {
  version: string;
  releaseUrl: string;
  releaseNotes: string;
}

export function useUpdateChecker() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [noUpdate, setNoUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("");

  const checkForUpdate = useCallback(async (manual = false) => {
    if (checking) return;
    setChecking(true);
    if (manual) setNoUpdate(false);

    try {
      const appVersion = await getVersion();
      setCurrentVersion(appVersion);

      const res = await fetch(
        `https://api.github.com/repos/${REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (!res.ok) return;

      const release = await res.json();
      const latest = (release.tag_name as string).replace(/^v/, "");

      if (isNewerVersion(latest, appVersion)) {
        setUpdate({
          version: latest,
          releaseUrl: release.html_url,
          releaseNotes: release.body ?? "",
        });
      } else if (manual) {
        setNoUpdate(true);
        setTimeout(() => setNoUpdate(false), 3000);
      }
    } catch {
      // 네트워크 오류 무시
    } finally {
      setChecking(false);
    }
  }, [checking]);

  useEffect(() => {
    // 앱 시작 시 자동 확인
    checkForUpdate(false);

    // 메뉴 "Check for Updates..." 클릭 이벤트 수신
    const unlisten = listen("check-for-updates", () => {
      checkForUpdate(true);
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  const openReleasePage = (url: string) => {
    openUrl(url);
  };

  const dismiss = () => setUpdate(null);

  return { update, checking, noUpdate, currentVersion, openReleasePage, dismiss };
}

/** semver 비교: latest > current이면 true */
function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [lMaj, lMin, lPatch] = parse(latest);
  const [cMaj, cMin, cPatch] = parse(current);

  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

const REPO = "nobel6018/claude-session-manager";
const CURRENT_VERSION = "0.2.0";

export interface UpdateInfo {
  version: string;
  releaseUrl: string;
  releaseNotes: string;
}

export function useUpdateChecker() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/releases/latest`,
          { headers: { Accept: "application/vnd.github+json" } }
        );
        if (!res.ok || cancelled) return;

        const release = await res.json();
        const latest = (release.tag_name as string).replace(/^v/, "");

        if (isNewerVersion(latest, CURRENT_VERSION)) {
          setUpdate({
            version: latest,
            releaseUrl: release.html_url,
            releaseNotes: release.body ?? "",
          });
        }
      } catch {
        // 네트워크 오류 무시 — 업데이트 확인 실패해도 앱은 정상 동작
      }
    }

    checkForUpdate();
    return () => { cancelled = true; };
  }, []);

  const openReleasePage = (url: string) => {
    openUrl(url);
  };

  const dismiss = () => setUpdate(null);

  return { update, openReleasePage, dismiss };
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

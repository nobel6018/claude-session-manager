import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { useStore } from "../store";

const META_URL = "https://claude-session-manager.vercel.app/meta.json";

interface VersionStatus {
  appVersion: string;
  feHash: string;
  feLatestHash: string | null;
  feIsLatest: boolean | null; // null = 확인 중
}

export function AboutModal() {
  const { showAbout, setShowAbout } = useStore();
  const [status, setStatus] = useState<VersionStatus | null>(null);

  // 메뉴 이벤트 수신
  useEffect(() => {
    const unlisten = listen("show-about", () => setShowAbout(true));
    return () => { unlisten.then(fn => fn()); };
  }, [setShowAbout]);

  // 모달 열릴 때마다 버전 정보 fetch
  useEffect(() => {
    if (!showAbout) return;

    setStatus(null);

    (async () => {
      const appVersion = await getVersion();
      const feHash = __GIT_HASH__;

      setStatus({ appVersion, feHash, feLatestHash: null, feIsLatest: null });

      try {
        const res = await fetch(META_URL, { cache: "no-store" });
        if (res.ok) {
          const meta: { gitHash: string } = await res.json();
          setStatus({
            appVersion,
            feHash,
            feLatestHash: meta.gitHash,
            feIsLatest: meta.gitHash === feHash,
          });
        }
      } catch {
        setStatus(prev => prev ? { ...prev, feIsLatest: null } : null);
      }
    })();
  }, [showAbout]);

  useEffect(() => {
    if (!showAbout) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowAbout(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showAbout, setShowAbout]);

  if (!showAbout) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setShowAbout(false)}
    >
      <div
        className="w-[340px] overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* App icon + name */}
        <div className="flex flex-col items-center px-8 pt-8 pb-5">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-bg-tertiary">
            <svg className="h-12 w-12 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-[17px] font-semibold text-text-primary">Claude Session Manager</h1>
        </div>

        <div className="border-t border-divider" />

        {/* Version info */}
        <div className="px-6 py-4 space-y-3">
          {/* App (backend) version */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-text-muted">앱 버전</span>
            {status ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] text-text-primary">v{status.appVersion}</span>
                <span className="rounded-full bg-green/15 px-2 py-0.5 text-[11px] text-green">최신 버전입니다</span>
              </div>
            ) : (
              <div className="h-4 w-20 animate-pulse rounded bg-bg-hover" />
            )}
          </div>

          {/* Frontend version */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-text-muted">UI 버전</span>
            {status ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] text-text-secondary">
                  fe:{status.feHash.slice(0, 7)}
                </span>
                {status.feIsLatest === null ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                ) : status.feIsLatest ? (
                  <span className="rounded-full bg-green/15 px-2 py-0.5 text-[11px] text-green">최신 버전입니다</span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
                    업데이트 있음
                    <kbd className="font-mono text-[10px]">⌘R</kbd>
                  </span>
                )}
              </div>
            ) : (
              <div className="h-4 w-32 animate-pulse rounded bg-bg-hover" />
            )}
          </div>

          {/* Latest FE hash when update available */}
          {status?.feIsLatest === false && status.feLatestHash && (
            <div className="rounded-lg bg-bg-tertiary px-3 py-2 text-[11px] text-text-muted">
              현재:{" "}
              <span className="font-mono">{status.feHash.slice(0, 7)}</span>
              {"  →  "}최신:{" "}
              <span className="font-mono text-accent">{status.feLatestHash.slice(0, 7)}</span>
              <span className="ml-2">⌘R로 업데이트</span>
            </div>
          )}
        </div>

        <div className="border-t border-divider" />

        <div className="px-6 py-3">
          <button
            className="w-full rounded-lg bg-bg-hover py-2 text-[13px] text-text-secondary transition-colors hover:bg-bg-selected hover:text-text-primary"
            onClick={() => setShowAbout(false)}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

import { useUpdateChecker } from "../hooks/useUpdateChecker";

export function UpdateBanner() {
  const {
    backendUpdate,
    frontendStatus,
    checking,
    showResult,
    currentBackendVersion,
    openReleasePage,
    dismissBackend,
  } = useUpdateChecker();

  // 확인 중 / 결과 — fixed 토스트 (레이아웃 영향 없음)
  if (checking || (showResult && !backendUpdate)) {
    const feOk = frontendStatus?.isLatest ?? true;

    return (
      <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-full border border-border bg-bg-secondary px-4 py-2 shadow-xl">
          {checking ? (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              <span className="text-[12px] text-text-muted">업데이트 확인 중...</span>
            </>
          ) : (
            <>
              {/* 백엔드 */}
              <div className="flex items-center gap-1.5">
                <svg className="h-3 w-3 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[12px] text-text-muted">
                  앱 최신 버전입니다{" "}
                  <span className="font-mono text-text-secondary">(v{currentBackendVersion})</span>
                </span>
              </div>

              <span className="text-text-muted/30">·</span>

              {/* 프론트엔드 */}
              {frontendStatus && (
                feOk ? (
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[12px] text-text-muted">
                      UI 최신 버전입니다{" "}
                      <span className="font-mono text-text-secondary">(fe:{frontendStatus.current.slice(0, 7)})</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-[12px] text-text-muted">
                      UI 업데이트 있음{" "}
                      <span className="font-mono text-text-muted/60">
                        {frontendStatus.current.slice(0, 7)} → {frontendStatus.latest.slice(0, 7)}
                      </span>
                    </span>
                    <kbd className="rounded border border-border/60 bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] text-accent">
                      ⌘R
                    </kbd>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // 백엔드 신규 버전 — in-flow 배너 (영구, 사용자가 직접 닫아야 함)
  if (backendUpdate) {
    return (
      <div className="flex items-center gap-3 border-b border-yellow/20 bg-yellow/8 px-5 py-2.5">
        <svg className="h-4 w-4 shrink-0 text-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
        <span className="text-sm text-text-primary">
          새 앱 버전{" "}
          <span className="font-semibold text-yellow">v{backendUpdate.version}</span>
          {frontendStatus && !frontendStatus.isLatest && (
            <span className="ml-2 text-[11px] text-text-muted">· UI 업데이트도 있음 (⌘R)</span>
          )}
        </span>
        <button
          className="rounded-md bg-yellow/15 px-3 py-1 text-xs font-medium text-yellow transition-colors hover:bg-yellow/25"
          onClick={() => openReleasePage(backendUpdate.releaseUrl)}
        >
          앱 다운로드
        </button>
        <button
          className="ml-auto text-text-muted transition-colors hover:text-text-primary"
          onClick={dismissBackend}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return null;
}

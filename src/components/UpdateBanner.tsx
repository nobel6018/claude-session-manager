import { useUpdateChecker } from "../hooks/useUpdateChecker";

export function UpdateBanner() {
  const { update, openReleasePage, dismiss } = useUpdateChecker();

  if (!update) return null;

  return (
    <div className="flex items-center gap-3 border-b border-yellow/20 bg-yellow/8 px-5 py-2.5">
      <svg
        className="h-4 w-4 shrink-0 text-yellow"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
        />
      </svg>
      <span className="text-sm text-text-primary">
        새 버전 <span className="font-semibold text-yellow">v{update.version}</span>이 출시되었습니다.
      </span>
      <button
        className="rounded-md bg-yellow/15 px-3 py-1 text-xs font-medium text-yellow transition-colors hover:bg-yellow/25"
        onClick={() => openReleasePage(update.releaseUrl)}
      >
        다운로드
      </button>
      <button
        className="ml-auto text-text-muted transition-colors hover:text-text-primary"
        onClick={dismiss}
        title="닫기"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

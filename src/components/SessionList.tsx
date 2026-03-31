import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useStore } from "../store";
import type { SessionSummary } from "../types";

interface ContextMenu {
  x: number;
  y: number;
  session: SessionSummary;
}

function ContextMenuPopup({ menu, onClose }: { menu: ContextMenu; onClose: () => void }) {
  const { deleteSession, resumeSession } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleDeleteConfirm = async () => {
    onClose();
    await deleteSession(menu.session.sessionId, menu.session.projectId);
  };

  const handleResume = async () => {
    onClose();
    await resumeSession(menu.session.sessionId, menu.session.cwd);
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-bg-secondary py-1 shadow-xl"
      style={{ left: menu.x, top: menu.y }}
    >
      {confirming ? (
        <div className="px-4 py-2">
          <p className="mb-2 text-xs text-text-secondary">정말 삭제할까요?</p>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-md bg-red/15 px-3 py-1 text-xs font-medium text-red hover:bg-red/25"
              onClick={handleDeleteConfirm}
            >
              삭제
            </button>
            <button
              className="flex-1 rounded-md bg-bg-hover px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
              onClick={() => setConfirming(false)}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-text-primary transition-colors hover:bg-bg-hover"
            onClick={handleResume}
          >
            <svg className="h-3.5 w-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            iTerm2에서 재개
            <span className="ml-auto text-xs text-text-muted">⌘↩</span>
          </button>
          <div className="my-1 border-t border-divider" />
          <button
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-red transition-colors hover:bg-bg-hover"
            onClick={() => setConfirming(true)}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            세션 삭제
            <span className="ml-auto text-xs text-text-muted">⌫</span>
          </button>
        </>
      )}
    </div>
  );
}

export function SessionList({ width }: { width: number }) {
  const {
    sessions,
    selectedSessionId,
    selectSession,
    selectedIndex,
    setSelectedIndex,
    toggleBookmark,
    isLoading,
    pinRenamed,
    setPinRenamed,
  } = useStore();
  const listRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const sortedSessions = useMemo(() => {
    if (!pinRenamed) return sessions;
    return [...sessions].sort((a, b) => {
      if (a.isRenamed !== b.isRenamed) return a.isRenamed ? -1 : 1;
      return 0;
    });
  }, [sessions, pinRenamed]);

  const handleContextMenu = useCallback((e: React.MouseEvent, session: SessionSummary) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, session });
  }, []);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (isLoading) {
    return (
      <div className="flex shrink-0 items-center justify-center border-r border-divider bg-bg-primary" style={{ width }}>
        <div className="text-center">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          <span className="text-sm text-text-muted">Loading sessions...</span>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex shrink-0 flex-col items-center justify-center border-r border-divider bg-bg-primary" style={{ width }}>
        <svg
          className="mb-4 h-12 w-12 text-text-muted/20"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <span className="text-sm text-text-muted">No sessions found</span>
        <span className="mt-1.5 text-xs text-text-muted/50">Try adjusting your search</span>
      </div>
    );
  }

  const renamedCount = sessions.filter((s) => s.isRenamed).length;

  return (
    <>
      <div
        ref={listRef}
        className="flex shrink-0 flex-col overflow-y-auto border-r border-divider bg-bg-primary"
        style={{ width }}
      >
        {/* Renamed-first toggle */}
        {renamedCount > 0 && (
          <div className="flex items-center justify-between border-b border-divider px-4 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <svg className="h-3 w-3 opacity-50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              이름 지정 <span className="tabular-nums font-medium">{renamedCount}</span>개
            </div>
            <button
              onClick={() => setPinRenamed(!pinRenamed)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                pinRenamed
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              title="이름 지정된 세션을 먼저 표시"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              이름 지정 먼저
            </button>
          </div>
        )}
        {sortedSessions.map((session, index) => (
          <SessionCard
            key={session.sessionId}
            session={session}
            index={index}
            isSelected={
              selectedSessionId === session.sessionId || selectedIndex === index
            }
            onSelect={() => {
              setSelectedIndex(index);
              selectSession(session.sessionId, session.projectId);
            }}
            onToggleBookmark={() => toggleBookmark(session.sessionId)}
            onContextMenu={(e) => handleContextMenu(e, session)}
          />
        ))}
      </div>
      {contextMenu && (
        <ContextMenuPopup
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

function SessionCard({
  session,
  index,
  isSelected,
  onSelect,
  onToggleBookmark,
  onContextMenu,
}: {
  session: SessionSummary;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggleBookmark: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const date = new Date(session.startedAt);
  const dateStr = formatRelativeDate(date);
  const projectShort = session.projectName.split("/").pop() || session.projectName;

  return (
    <div
      data-index={index}
      onContextMenu={onContextMenu}
      className={`group cursor-pointer border-b border-divider px-5 py-2.5 transition-colors duration-100 ${
        isSelected
          ? "border-l-[3px] border-l-accent bg-bg-selected"
          : "border-l-[3px] border-l-transparent hover:bg-bg-hover"
      }`}
      onClick={onSelect}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {session.isRenamed && (
            <svg
              className="h-3 w-3 shrink-0 text-accent/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="이름이 지정된 세션"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          )}
          <h3
            className="flex-1 truncate text-[14px] font-medium leading-snug text-text-primary"
          >
            {session.title}
          </h3>
        </div>
        <button
          className={`mt-0.5 shrink-0 transition-all duration-100 ${
            session.isBookmarked
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-50 hover:!opacity-100"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark();
          }}
          title={session.isBookmarked ? "Remove bookmark" : "Add bookmark"}
        >
          {session.isBookmarked ? (
            <svg className="h-4 w-4 text-yellow" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )}
        </button>
      </div>

      {/* Project path */}
      <div className="mt-2 text-[12px] font-medium text-text-muted/70">
        {projectShort}
      </div>

      {/* Meta info */}
      <div className="mt-2.5 flex items-center gap-2.5 text-[12px] text-text-muted">
        <span>{dateStr}</span>
        <span className="opacity-30">·</span>
        <span>{session.messageCount} msgs</span>
        {session.toolUseCount > 0 && (
          <>
            <span className="opacity-30">·</span>
            <span className="font-mono text-tool">{session.toolUseCount} tools</span>
          </>
        )}
      </div>

      {/* Tags */}
      {session.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {session.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-accent/20 bg-accent/8 px-2.5 py-0.5 text-[11px] text-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

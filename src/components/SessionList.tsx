import React, { useRef, useEffect, useState, useCallback } from "react";
import { useStore } from "../store";
import type { SessionSummary } from "../types";

interface ContextMenu {
  x: number;
  y: number;
  session: SessionSummary;
}

function ContextMenuPopup({ menu, onClose }: { menu: ContextMenu; onClose: () => void }) {
  const { deleteSession, resumeSession, terminalApp } = useStore();
  const terminalLabel = terminalApp === 'cmux' ? 'cmux' : 'iTerm2';
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
          <p className="mb-1 text-xs text-text-secondary">정말 숨길까요?</p>
          <p className="mb-3 text-[11px] text-text-muted">파일은 삭제되지 않고 숨겨집니다.</p>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-md bg-red/15 px-3 py-1 text-xs font-medium text-red hover:bg-red/25"
              onClick={handleDeleteConfirm}
            >
              숨기기
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
            {terminalLabel}에서 재개
            <span className="ml-auto text-xs text-text-muted">⌘↩</span>
          </button>
          <div className="my-1 border-t border-divider" />
          <button
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-red transition-colors hover:bg-bg-hover"
            onClick={() => setConfirming(true)}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
            세션 숨김
            <span className="ml-auto text-xs text-text-muted">⌫</span>
          </button>
        </>
      )}
    </div>
  );
}

export function SessionList({ width, panelRef }: { width: number; panelRef?: React.RefObject<HTMLDivElement | null> }) {
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
    showDeleted,
    deletedSessions,
    toggleShowDeleted,
    restoreSession,
  } = useStore();
  const listRef = useRef<HTMLDivElement>(null);

  // listRef(scrollIntoView)와 panelRef(드래그 DOM 조작)를 같은 엘리먼트에 연결
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (panelRef) (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [panelRef]);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, session: SessionSummary) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, session });
  }, []);

  useEffect(() => {
    if (showDeleted) return;
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, showDeleted]);

  if (isLoading) {
    return (
      <div ref={panelRef} className="flex shrink-0 items-center justify-center border-r border-divider bg-bg-primary" style={{ width }}>
        <div className="text-center">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          <span className="text-sm text-text-muted">Loading sessions...</span>
        </div>
      </div>
    );
  }

  if (!showDeleted && sessions.length === 0) {
    return (
      <div className="flex shrink-0 flex-col items-center justify-center border-r border-divider bg-bg-primary" style={{ width }}>
        <svg className="mb-4 h-12 w-12 text-text-muted/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <span className="text-sm text-text-muted">No sessions found</span>
        <span className="mt-1.5 text-xs text-text-muted/50">Try adjusting your search</span>
      </div>
    );
  }

  const renamedCount = sessions.filter((s) => s.isRenamed).length;
  const hasDeleted = deletedSessions.length > 0;

  return (
    <>
      <div
        ref={mergedRef}
        className="flex shrink-0 flex-col overflow-y-auto border-r border-divider bg-bg-primary"
        style={{ width }}
      >
        {/* ── 헤더: 이름 지정 먼저 + 숨겨진 세션 토글 ── */}
        {(renamedCount > 0 || hasDeleted) && (
          <div className="flex items-center justify-between border-b border-divider px-3 py-2 flex-shrink-0">
            {/* 왼쪽: 이름 지정 먼저 */}
            {renamedCount > 0 ? (
              <div className="flex items-center gap-1.5">
                <svg className="h-3 w-3 shrink-0 text-text-muted opacity-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className={`text-[11px] text-text-muted tabular-nums transition-opacity ${showDeleted ? "opacity-35" : ""}`}>
                  이름 지정 {renamedCount}개
                </span>
                <button
                  onClick={() => setPinRenamed(!pinRenamed)}
                  disabled={showDeleted}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all ${
                    showDeleted
                      ? "opacity-30 cursor-not-allowed text-text-muted"
                      : pinRenamed
                        ? "bg-accent/15 text-accent"
                        : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
                  }`}
                  title="이름 지정된 세션을 먼저 표시"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  먼저 표시
                </button>
              </div>
            ) : (
              <div />
            )}

            {/* 오른쪽: 숨겨진 세션 토글 */}
            <button
              onClick={toggleShowDeleted}
              disabled={!hasDeleted}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-all ${
                !hasDeleted
                  ? "cursor-not-allowed border-transparent text-text-muted opacity-25"
                  : showDeleted
                    ? "border-accent/25 bg-accent/12 text-accent"
                    : "border-divider text-text-muted hover:border-border hover:text-text-secondary"
              }`}
              title={hasDeleted ? "숨겨진 세션 보기" : "숨겨진 세션 없음"}
            >
              <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showDeleted ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                ) : (
                  <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                )}
              </svg>
              숨겨진 세션
              {hasDeleted && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums font-semibold ${showDeleted ? "bg-accent text-white" : "bg-bg-hover text-text-muted"}`}>
                  {deletedSessions.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── 숨겨진 세션 모드 배너 ── */}
        {showDeleted && (
          <div className="flex items-center gap-2 border-b border-accent/15 bg-accent/7 px-4 py-1.5 flex-shrink-0">
            <svg className="h-3 w-3 shrink-0 text-accent/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242" />
            </svg>
            <span className="flex-1 text-[11px] text-accent/70">
              숨겨진 세션 {deletedSessions.length}개 — 복구하면 목록에 다시 나타납니다
            </span>
          </div>
        )}

        {/* ── 세션 목록 (일반 또는 숨겨진) ── */}
        {showDeleted ? (
          deletedSessions.map((session) => (
            <DeletedSessionRow
              key={session.sessionId}
              session={session}
              isSelected={selectedSessionId === session.sessionId}
              onSelect={() => selectSession(session.sessionId, session.projectId)}
              onRestore={() => restoreSession(session.sessionId, session.projectId)}
            />
          ))
        ) : (
          sessions.map((session, index) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              index={index}
              isSelected={selectedSessionId === session.sessionId || selectedIndex === index}
              onSelect={() => {
                setSelectedIndex(index);
                selectSession(session.sessionId, session.projectId);
              }}
              onToggleBookmark={() => toggleBookmark(session.sessionId)}
              onContextMenu={(e) => handleContextMenu(e, session)}
            />
          ))
        )}
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

function DeletedSessionRow({
  session,
  isSelected,
  onSelect,
  onRestore,
}: {
  session: SessionSummary;
  isSelected: boolean;
  onSelect: () => void;
  onRestore: () => void;
}) {
  const date = new Date(session.startedAt);
  const dateStr = formatRelativeDate(date);
  const projectShort = session.projectName.split("/").pop() || session.projectName;

  return (
    <div
      className={`group cursor-pointer border-b border-divider px-5 py-2.5 transition-colors duration-100 ${
        isSelected
          ? "border-l-[3px] border-l-accent bg-bg-selected"
          : "border-l-[3px] border-l-transparent hover:bg-bg-hover"
      }`}
      style={{ opacity: isSelected ? 0.9 : 0.65 }}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex-1 truncate text-[14px] font-medium leading-snug text-text-primary">
          {session.title}
        </h3>
        <button
          className="mt-0.5 shrink-0 rounded-md bg-bg-hover px-2.5 py-1 text-[11px] font-medium text-text-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-accent/15 hover:text-accent"
          onClick={(e) => { e.stopPropagation(); onRestore(); }}
          title="세션 복구"
        >
          복구
        </button>
      </div>
      <div className="mt-2 text-[12px] font-medium text-text-muted/70">{projectShort}</div>
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

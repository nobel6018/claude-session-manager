import { useRef, useEffect } from "react";
import { useStore } from "../store";
import type { SessionSummary } from "../types";

export function SessionList() {
  const {
    sessions,
    selectedSessionId,
    selectSession,
    selectedIndex,
    setSelectedIndex,
    toggleBookmark,
    isLoading,
  } = useStore();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (isLoading) {
    return (
      <div className="flex w-[360px] items-center justify-center border-r border-divider bg-bg-primary">
        <div className="text-center">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          <span className="text-sm text-text-muted">Loading sessions...</span>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex w-[360px] flex-col items-center justify-center border-r border-divider bg-bg-primary">
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

  return (
    <div
      ref={listRef}
      className="flex w-[360px] flex-col overflow-y-auto border-r border-divider bg-bg-primary"
    >
      {sessions.map((session, index) => (
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
        />
      ))}
    </div>
  );
}

function SessionCard({
  session,
  index,
  isSelected,
  onSelect,
  onToggleBookmark,
}: {
  session: SessionSummary;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggleBookmark: () => void;
}) {
  const date = new Date(session.startedAt);
  const dateStr = formatRelativeDate(date);
  const projectShort = session.projectName.split("/").pop() || session.projectName;

  return (
    <div
      data-index={index}
      className={`group cursor-pointer border-b border-divider px-5 py-2.5 transition-colors duration-100 ${
        isSelected
          ? "border-l-[3px] border-l-accent bg-bg-selected"
          : "border-l-[3px] border-l-transparent hover:bg-bg-hover"
      }`}
      onClick={onSelect}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`flex-1 truncate text-[14px] font-medium leading-snug ${
            isSelected ? "text-text-primary" : "text-text-primary"
          }`}
        >
          {session.title}
        </h3>
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

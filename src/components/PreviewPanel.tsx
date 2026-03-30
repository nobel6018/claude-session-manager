import { useState } from "react";
import { useStore } from "../store";
import type { Message } from "../types";

export function PreviewPanel() {
  const {
    sessionDetail,
    selectedSessionId,
    sessions,
    resumeSession,
    addTag,
    removeTag,
    tagInput,
    setTagInput,
  } = useStore();

  const selectedSession = sessions.find(
    (s) => s.sessionId === selectedSessionId
  );

  if (!sessionDetail || !selectedSession) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg-primary">
        <div className="text-center">
          <svg
            className="mx-auto mb-5 h-16 w-16 opacity-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-[15px] font-medium text-text-secondary">Select a session</p>
          <p className="mt-2 text-[13px] text-text-muted/60">Use j/k to navigate · ⌘K to search</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-bg-primary">
      {/* Header */}
      <div className="border-b border-divider bg-bg-secondary px-8 py-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-snug text-text-primary">
              {selectedSession.title}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-muted">
              <span className="font-medium text-text-secondary">
                {selectedSession.projectName}
              </span>
              <span className="opacity-30">·</span>
              <span>
                {new Date(selectedSession.startedAt).toLocaleString("ko-KR")}
              </span>
              <span className="opacity-30">·</span>
              <span>{selectedSession.messageCount} messages</span>
            </div>
          </div>
          <button
            className="shrink-0 rounded-lg border border-accent/40 px-4 py-2.5 text-[13px] font-medium text-accent transition-all duration-150 hover:border-accent/70 hover:bg-accent/10 active:scale-95"
            onClick={() => resumeSession(selectedSession.sessionId, selectedSession.cwd)}
            title="Resume in terminal (⌘↩)"
          >
            Resume
            <kbd className="ml-2 font-mono text-[11px] opacity-60">⌘↩</kbd>
          </button>
        </div>

        {/* Tags */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {selectedSession.tags.map((tag) => (
            <span
              key={tag}
              className="group flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-[12px] text-accent"
            >
              {tag}
              <button
                className="hidden leading-none text-accent/40 transition-colors hover:text-red group-hover:inline"
                onClick={() => removeTag(selectedSession.sessionId, tag)}
              >
                ×
              </button>
            </span>
          ))}
          <form
            className="inline-flex"
            onSubmit={(e) => {
              e.preventDefault();
              if (tagInput.trim()) {
                addTag(selectedSession.sessionId, tagInput.trim());
                setTagInput("");
              }
            }}
          >
            <input
              type="text"
              placeholder="+ tag"
              className="w-16 rounded-full bg-bg-tertiary px-3 py-1 text-[12px] text-text-secondary outline-none placeholder:text-text-muted focus:w-28 focus:ring-1 focus:ring-accent/30 transition-all duration-150"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
            />
          </form>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="space-y-8">
          {sessionDetail.messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);

  switch (message.msgType) {
    case "user":
      return (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-green">
            You
          </div>
          <div className="rounded-xl bg-bg-tertiary px-5 py-4 text-[14px] leading-relaxed text-text-primary">
            {message.content}
          </div>
        </div>
      );

    case "assistant":
      return (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-accent">
            Claude
          </div>
          <div
            className={`rounded-xl bg-bg-secondary px-5 py-4 text-[14px] leading-relaxed text-text-secondary ${
              !expanded && message.content.length > 400 ? "line-clamp-5" : ""
            }`}
          >
            {message.content}
          </div>
          {message.content.length > 400 && (
            <button
              className="mt-2 text-[13px] text-accent/80 transition-colors hover:text-accent"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      );

    case "toolUse":
      return (
        <div className="flex items-start gap-3.5 rounded-xl border border-border/50 bg-bg-secondary/60 px-5 py-4">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-tool"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[13px] font-medium text-tool">
              {message.toolName}
            </span>
            {message.toolInputPreview && (
              <div className="mt-1.5 truncate font-mono text-[12px] text-text-muted/70">
                {message.toolInputPreview}
              </div>
            )}
          </div>
        </div>
      );

    case "toolResult":
      if (!message.content) return null;
      return (
        <div className="ml-8 border-l-2 border-border/40 pl-5">
          <div className="line-clamp-3 font-mono text-[12px] leading-relaxed text-text-muted/60">
            {message.content}
          </div>
        </div>
      );

    default:
      return null;
  }
}

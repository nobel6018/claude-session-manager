import { useRef, useEffect } from "react";
import { useStore } from "../store";
import { ThemeSelector } from "./ThemeSelector";
import { useFlash } from "../hooks/useFlash";


export function SearchBar() {
  const { searchQuery, setSearchQuery, searchFocused, setSearchFocused, setShowShortcuts, showShortcuts } =
    useStore();
  const flash = useFlash(showShortcuts);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchFocused]);

  const isEmpty = !searchQuery && !searchFocused;

  return (
    <div className="flex items-center border-b border-divider bg-bg-secondary px-6 py-4">
      <div
        className="flex flex-1 items-center gap-3 rounded-xl bg-bg-tertiary px-5 py-3 transition-all duration-150 focus-within:ring-1 focus-within:ring-accent/40"
      >
        <svg
          className="h-4 w-4 shrink-0 text-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search sessions..."
          className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {searchQuery && (
          <button
            className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
            onClick={() => setSearchQuery("")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {isEmpty && (
          <kbd className="shrink-0 rounded-md border border-border/60 bg-bg-primary/50 px-2 py-1 font-mono text-[10px] text-text-muted">
            ⌘K
          </kbd>
        )}
      </div>

      <button
        className={`ml-4 flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 transition-colors ${flash ? "bg-accent/15 text-accent" : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"}`}
        onClick={() => setShowShortcuts(true)}
        title="단축키 목록 (⌘/)"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="7" width="20" height="12" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12h.01M12 12h.01M17 12h.01M7 16h10" />
        </svg>
        <kbd className="hidden font-mono text-[10px] lg:block">⌘/</kbd>
      </button>
      <ThemeSelector />
    </div>
  );
}

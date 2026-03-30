import { useRef, useEffect } from "react";
import { useStore } from "../store";
import { ThemeSelector } from "./ThemeSelector";

export function SearchBar() {
  const { searchQuery, setSearchQuery, searchFocused, setSearchFocused } =
    useStore();
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

      <div className="ml-5 hidden items-center gap-2.5 text-[11px] text-text-muted lg:flex">
        <div className="flex items-center gap-1.5">
          <kbd className="rounded-md border border-border/60 bg-bg-tertiary px-2 py-1 font-mono text-[10px]">j/k</kbd>
          <span>navigate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="rounded-md border border-border/60 bg-bg-tertiary px-2 py-1 font-mono text-[10px]">⌘↩</kbd>
          <span>resume</span>
        </div>
      </div>
      <ThemeSelector />
    </div>
  );
}

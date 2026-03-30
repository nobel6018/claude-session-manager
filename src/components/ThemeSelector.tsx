import { useState, useRef, useEffect } from "react";
import { useStore } from "../store";
import { themes } from "../themes";

export function ThemeSelector() {
  const { theme, setTheme } = useStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative ml-3 shrink-0">
      <button
        title="Switch theme"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" strokeWidth={2} />
          <path
            strokeLinecap="round"
            strokeWidth={2}
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 min-w-[180px] rounded-xl border border-border/60 bg-bg-panel py-1.5 shadow-lg">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-bg-hover ${
                t.id === theme.id ? "text-accent" : "text-text-primary"
              }`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: t.colors.accent }}
              />
              <span>{t.name}</span>
              {t.id === theme.id && (
                <svg className="ml-auto h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 12 12">
                  <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

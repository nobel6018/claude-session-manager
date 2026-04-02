import { useEffect } from "react";
import { useStore } from "../store";

const SHORTCUTS = [
  { section: "탐색", items: [
    { keys: ["j", "↓"], description: "다음 세션으로 이동" },
    { keys: ["k", "↑"], description: "이전 세션으로 이동" },
  ]},
  { section: "검색", items: [
    { keys: ["⌘K", "/"], description: "검색 포커스" },
    { keys: ["Esc"], description: "검색 닫기" },
  ]},
  { section: "세션", items: [
    { keys: ["⌘↩"], description: "선택된 세션 iTerm2에서 재개" },
    { keys: ["⌫"], description: "선택된 세션 삭제" },
    { keys: ["⌘R"], description: "세션 목록 새로고침" },
  ]},
  { section: "창", items: [
    { keys: ["⌘N"], description: "창 열기" },
    { keys: ["⌘W"], description: "창 숨기기 (백그라운드 유지)" },
    { keys: ["⌘Q"], description: "앱 완전 종료" },
  ]},
  { section: "기타", items: [
    { keys: ["⌘."], description: "프로젝트 사이드바 접기/펼치기" },
    { keys: ["⌘/"], description: "단축키 목록 표시/숨김" },
  ]},
];

function splitKeyCombo(key: string): string[] {
  const modifiers = ["⌘", "⌃", "⌥", "⇧"];
  const parts: string[] = [];
  let rest = key;
  for (const mod of modifiers) {
    if (rest.startsWith(mod)) {
      parts.push(mod);
      rest = rest.slice(mod.length);
    }
  }
  if (rest) parts.push(rest);
  return parts.length > 1 ? parts : [key];
}

export function ShortcutsModal() {
  const { showShortcuts, setShowShortcuts } = useStore();

  useEffect(() => {
    if (!showShortcuts) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "/")) {
        e.preventDefault();
        setShowShortcuts(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showShortcuts, setShowShortcuts]);

  if (!showShortcuts) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setShowShortcuts(false)}
    >
      <div
        className="w-[420px] overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-divider px-6 py-4">
          <h2 className="text-[15px] font-semibold text-text-primary">단축키</h2>
          <button
            className="rounded-md px-2 py-1 text-[11px] text-text-muted transition-colors hover:text-text-primary"
            onClick={() => setShowShortcuts(false)}
          >
            <kbd className="font-mono">Esc</kbd>
          </button>
        </div>

        {/* Shortcut list */}
        <div className="px-6 py-5 space-y-5">
          {SHORTCUTS.map(({ section, items }) => (
            <div key={section}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted/60">
                {section}
              </p>
              <div className="space-y-1">
                {items.map(({ keys, description }) => (
                  <div
                    key={description}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-bg-hover"
                  >
                    <span className="text-[13px] text-text-secondary">{description}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((key, i) => (
                        <span key={key} className="flex items-center gap-1">
                          {i > 0 && <span className="text-[10px] text-text-muted/40">또는</span>}
                          <span className="flex items-center gap-0.5">
                            {splitKeyCombo(key).map((part) => (
                              <kbd key={part} className="rounded-md border border-border/60 bg-bg-primary/80 px-2 py-0.5 font-mono text-[11px] text-text-primary">
                                {part}
                              </kbd>
                            ))}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

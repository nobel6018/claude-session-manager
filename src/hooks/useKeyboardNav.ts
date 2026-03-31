import { useEffect } from "react";
import { useStore } from "../store";

export function useKeyboardNav() {
  const {
    moveSelection,
    sessions,
    selectedIndex,
    resumeSession,
    setSearchFocused,
    searchFocused,
    setSearchQuery,
    refresh,
    deleteSession,
    showShortcuts,
    setShowShortcuts,
  } = useStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+/: Toggle shortcuts modal
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
        return;
      }

      // Cmd+K: Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchFocused(true);
        return;
      }

      // Cmd+R: Refresh sessions
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        refresh();
        return;
      }

      // Cmd+Enter: Resume selected session
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        const session = sessions[selectedIndex];
        if (session) {
          resumeSession(session.sessionId, session.cwd);
        }
        return;
      }

      // Escape: Close shortcuts modal, or clear search
      if (e.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (searchFocused) {
          setSearchFocused(false);
          setSearchQuery("");
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      // Skip keyboard nav when typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // Delete / Backspace: delete selected session directly (recoverable — renamed to .deleted)
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const session = sessions[selectedIndex];
        if (session) {
          deleteSession(session.sessionId, session.projectId);
        }
        return;
      }

      // j/k or arrow keys: Navigate sessions
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1);
        return;
      }

      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1);
        return;
      }

      // /: Focus search
      if (e.key === "/") {
        e.preventDefault();
        setSearchFocused(true);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    moveSelection,
    sessions,
    selectedIndex,
    resumeSession,
    setSearchFocused,
    searchFocused,
    setSearchQuery,
    refresh,
    deleteSession,
    showShortcuts,
    setShowShortcuts,
  ]);
}

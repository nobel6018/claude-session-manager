import { useEffect } from "react";
import { useStore } from "./store";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { SessionList } from "./components/SessionList";
import { PreviewPanel } from "./components/PreviewPanel";
import { SearchBar } from "./components/SearchBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { AboutModal } from "./components/AboutModal";
import { useKeyboardNav } from "./hooks/useKeyboardNav";
import { usePanelResize } from "./hooks/usePanelResize";
import { applyTheme } from "./themes";

// Snap points in px — sidebar and session list panel widths
const SIDEBAR_SNAPS = [160, 180, 208, 224, 256, 280];
const SESSION_SNAPS = [260, 300, 340, 360, 400, 440];

function ResizeHandle({
  onMouseDown,
  onDoubleClick,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  return (
    <div
      className="group relative z-10 w-4 shrink-0 cursor-col-resize"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title="더블클릭으로 기본 너비로 초기화"
    >
      <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-divider transition-colors duration-100 group-hover:w-[3px] group-hover:bg-accent/60 group-active:bg-accent" />
    </div>
  );
}

function App() {
  const { loadProjects, loadSessions, theme } = useStore();

  const { sidebarCollapsed } = useStore();
  const sidebar = usePanelResize(208, "sidebarWidth", SIDEBAR_SNAPS, 140, 360);
  const session = usePanelResize(360, "sessionWidth", SESSION_SNAPS, 240, 560);

  useEffect(() => {
    applyTheme(theme);
    loadProjects();
    loadSessions();
  }, [loadProjects, loadSessions, theme]);

  useKeyboardNav();

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      <UpdateBanner />
      <SearchBar />
      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar width={sidebar.width} />
        {!sidebarCollapsed && (
          <ResizeHandle onMouseDown={sidebar.startResize} onDoubleClick={sidebar.reset} />
        )}
        <SessionList width={session.width} />
        <ResizeHandle onMouseDown={session.startResize} onDoubleClick={session.reset} />
        <PreviewPanel />
      </div>
      <ShortcutsModal />
      <AboutModal />
    </div>
  );
}

export default App;

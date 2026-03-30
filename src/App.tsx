import { useEffect } from "react";
import { useStore } from "./store";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { SessionList } from "./components/SessionList";
import { PreviewPanel } from "./components/PreviewPanel";
import { SearchBar } from "./components/SearchBar";
import { useKeyboardNav } from "./hooks/useKeyboardNav";
import { applyTheme } from "./themes";

function App() {
  const { loadProjects, loadSessions, theme } = useStore();

  useEffect(() => {
    applyTheme(theme);
    loadProjects();
    loadSessions();
  }, [loadProjects, loadSessions, theme]);

  useKeyboardNav();

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      <SearchBar />
      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar />
        <SessionList />
        <PreviewPanel />
      </div>
    </div>
  );
}

export default App;

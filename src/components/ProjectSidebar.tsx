import { useStore } from "../store";
import type { Project } from "../types";

function formatProjectName(name: string): { primary: string; secondary: string } {
  if (name === "Home") {
    return { primary: "Home", secondary: "" };
  }

  const clean = name.replace(/^~\//, "");
  const parts = clean.split("/");

  if (parts.length <= 1) {
    return { primary: parts[0] || name, secondary: "" };
  }

  const primary = parts[parts.length - 1];
  const secondary = parts.slice(0, -1).join("/");
  return { primary, secondary };
}

export function ProjectSidebar({ width }: { width: number }) {
  const { projects, selectedProjectId, selectProject, sidebarCollapsed, toggleSidebar } = useStore();

  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);

  const effectiveWidth = sidebarCollapsed ? 28 : width;

  return (
    <div
      className="flex shrink-0 flex-col border-r border-divider bg-bg-panel overflow-hidden"
      style={{ width: effectiveWidth, transition: "width 180ms ease" }}
    >
      {sidebarCollapsed ? (
        /* Collapsed strip — click to expand */
        <button
          className="flex flex-1 w-full items-start justify-center pt-5 text-text-muted hover:text-accent transition-colors"
          onClick={toggleSidebar}
          title="사이드바 펼치기 (⌘.)"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Projects
            </h2>
            <button
              className="text-text-muted hover:text-accent transition-colors"
              onClick={toggleSidebar}
              title="사이드바 접기 (⌘.)"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Frontend build info */}
          <div
            className="shrink-0 border-b border-divider px-5 pb-2.5"
            title={`빌드 시각: ${new Date(__BUILD_TIME__).toLocaleString("ko-KR")}`}
          >
            <span className="font-mono text-[10px] text-text-muted/50">
              fe: {__GIT_HASH__}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4">
            {/* All Sessions */}
            <button
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-colors duration-100 ${
                selectedProjectId === null
                  ? "bg-accent-glow text-accent"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
              onClick={() => selectProject(null)}
            >
              <span className="text-[13px] font-medium">All Sessions</span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                  selectedProjectId === null
                    ? "bg-accent/15 text-accent"
                    : "bg-bg-tertiary text-text-muted"
                }`}
              >
                {totalSessions}
              </span>
            </button>

            <div className="mx-1 my-3 border-t border-divider" />

            {/* Project List */}
            {projects.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                isSelected={selectedProjectId === project.id}
                onSelect={() => selectProject(project.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectItem({
  project,
  isSelected,
  onSelect,
}: {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { primary, secondary } = formatProjectName(project.name);

  return (
    <button
      className={`mb-1 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-100 ${
        isSelected
          ? "bg-accent-glow text-accent"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      }`}
      onClick={onSelect}
      title={project.path}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium leading-snug">{primary}</div>
        {secondary && (
          <div className="mt-0.5 truncate text-[11px] leading-snug text-text-muted">
            {secondary}
          </div>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${
          isSelected
            ? "bg-accent/15 text-accent"
            : "bg-bg-tertiary text-text-muted"
        }`}
      >
        {project.sessionCount}
      </span>
    </button>
  );
}

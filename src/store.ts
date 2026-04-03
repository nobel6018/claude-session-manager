import { create } from "zustand";

function sortSessions(sessions: import("./types").SessionSummary[], pinRenamed: boolean) {
  if (!pinRenamed) return sessions;
  return [...sessions].sort((a, b) => {
    if (a.isRenamed !== b.isRenamed) return a.isRenamed ? -1 : 1;
    return 0;
  });
}
import { invoke } from "@tauri-apps/api/core";
import type { Project, SessionSummary, SessionDetail } from "./types";
import { themes, defaultThemeId, applyTheme } from "./themes";
import type { Theme } from "./themes";

interface AppState {
  // Data
  projects: Project[];
  sessions: SessionSummary[];
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  sessionDetail: SessionDetail | null;
  allTags: string[];

  // UI
  searchQuery: string;
  searchFocused: boolean;
  selectedIndex: number;
  isLoading: boolean;
  tagInput: string;
  theme: Theme;
  pinRenamed: boolean;
  showShortcuts: boolean;
  showAbout: boolean;
  sidebarCollapsed: boolean;
  showDeleted: boolean;
  deletedSessions: import("./types").SessionSummary[];
  terminalApp: 'iterm2' | 'cmux';

  // Actions
  loadProjects: () => Promise<void>;
  loadSessions: (projectId?: string | null) => Promise<void>;
  loadSessionDetail: (sessionId: string, projectId: string) => Promise<void>;
  selectProject: (projectId: string | null) => void;
  selectSession: (sessionId: string, projectId: string) => void;
  setSearchQuery: (query: string) => void;
  setSearchFocused: (focused: boolean) => void;
  setSelectedIndex: (index: number) => void;
  moveSelection: (delta: number) => void;
  resumeSession: (sessionId: string, cwd: string) => Promise<void>;
  toggleBookmark: (sessionId: string) => Promise<void>;
  addTag: (sessionId: string, tag: string) => Promise<void>;
  removeTag: (sessionId: string, tag: string) => Promise<void>;
  setTagInput: (input: string) => void;
  searchSessions: (query: string) => Promise<void>;
  setTheme: (themeId: string) => void;
  setPinRenamed: (value: boolean) => void;
  setShowShortcuts: (value: boolean) => void;
  setShowAbout: (value: boolean) => void;
  toggleSidebar: () => void;
  refresh: () => void;
  deleteSession: (sessionId: string, projectId: string) => Promise<void>;
  loadDeletedSessions: (projectId?: string | null) => Promise<void>;
  toggleShowDeleted: () => void;
  restoreSession: (sessionId: string, projectId: string) => Promise<void>;
  setTerminalApp: (app: 'iterm2' | 'cmux') => void;
}

export const useStore = create<AppState>((set, get) => ({
  projects: [],
  sessions: [],
  selectedProjectId: null,
  selectedSessionId: null,
  sessionDetail: null,
  allTags: [],
  searchQuery: "",
  searchFocused: false,
  selectedIndex: 0,
  isLoading: false,
  tagInput: "",
  theme: (() => {
    const savedId = localStorage.getItem("theme") ?? defaultThemeId;
    return themes.find((t) => t.id === savedId) ?? themes[0];
  })(),
  pinRenamed: localStorage.getItem("pinRenamed") === "true",
  showShortcuts: false,
  showAbout: false,
  sidebarCollapsed: localStorage.getItem("sidebarCollapsed") === "true",
  showDeleted: false,
  deletedSessions: [],
  terminalApp: (localStorage.getItem("terminalApp") as 'iterm2' | 'cmux') ?? 'iterm2',

  loadProjects: async () => {
    const projects = await invoke<Project[]>("get_projects");
    const allTags = await invoke<string[]>("get_all_tags");
    set({ projects, allTags });
  },

  loadSessions: async (projectId?: string | null) => {
    set({ isLoading: true });
    const raw = await invoke<SessionSummary[]>("get_sessions", {
      projectId: projectId ?? null,
    });
    set({ sessions: sortSessions(raw, get().pinRenamed), isLoading: false, selectedIndex: 0 });
  },

  loadSessionDetail: async (sessionId: string, projectId: string) => {
    const detail = await invoke<SessionDetail>("get_session_detail", {
      sessionId,
      projectId,
    });
    set({ sessionDetail: detail });
  },

  selectProject: (projectId: string | null) => {
    set({
      selectedProjectId: projectId,
      selectedSessionId: null,
      sessionDetail: null,
      selectedIndex: 0,
      showDeleted: false,
    });
    get().loadSessions(projectId);
    get().loadDeletedSessions(projectId);
  },

  selectSession: (sessionId: string, projectId: string) => {
    set({ selectedSessionId: sessionId });
    get().loadSessionDetail(sessionId, projectId);
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    if (query.trim()) {
      get().searchSessions(query);
    } else {
      get().loadSessions(get().selectedProjectId);
    }
  },

  setSearchFocused: (focused: boolean) => set({ searchFocused: focused }),
  setSelectedIndex: (index: number) => set({ selectedIndex: index }),
  setTagInput: (input: string) => set({ tagInput: input }),

  deleteSession: async (sessionId: string, projectId: string) => {
    await invoke("delete_session", { sessionId, projectId });

    const { selectedSessionId, selectedIndex, sessions, projects } = get();
    const deletedIndex = sessions.findIndex(s => s.sessionId === sessionId);
    const updatedSessions = sessions.filter(s => s.sessionId !== sessionId);
    const updatedProjects = projects.map(p =>
      p.id === projectId && p.sessionCount > 0
        ? { ...p, sessionCount: p.sessionCount - 1 }
        : p
    );

    if (selectedSessionId === sessionId) {
      // 삭제된 항목 위치에서 다음 세션 선택 (마지막이면 이전 세션)
      const nextIndex = Math.min(deletedIndex, updatedSessions.length - 1);
      const nextSession = nextIndex >= 0 ? updatedSessions[nextIndex] : null;
      set({
        sessions: updatedSessions,
        projects: updatedProjects,
        selectedIndex: Math.max(0, nextIndex),
        selectedSessionId: nextSession?.sessionId ?? null,
        sessionDetail: null,
      });
      if (nextSession) get().loadSessionDetail(nextSession.sessionId, nextSession.projectId);
    } else {
      // 선택되지 않은 항목 삭제 시 — 삭제 위치가 현재 선택 위에 있으면 index 보정
      const adjustedIndex = deletedIndex < selectedIndex ? selectedIndex - 1 : selectedIndex;
      set({ sessions: updatedSessions, projects: updatedProjects, selectedIndex: adjustedIndex });
    }
  },

  refresh: () => {
    // ⌘R: 페이지 전체 리로드 → Vercel CDN에서 최신 프론트엔드 재취득
    // App.tsx의 useEffect가 재실행되어 세션 데이터도 자동으로 갱신됨
    window.location.reload();
  },

  setTheme: (themeId: string) => {
    const theme = themes.find((t) => t.id === themeId) ?? themes[0];
    localStorage.setItem("theme", theme.id);
    applyTheme(theme);
    set({ theme });
  },

  setPinRenamed: (value: boolean) => {
    localStorage.setItem("pinRenamed", String(value));
    set(state => ({
      pinRenamed: value,
      sessions: sortSessions(state.sessions, value),
      selectedIndex: 0,
    }));
  },

  setShowShortcuts: (value: boolean) => set({ showShortcuts: value }),
  setShowAbout: (value: boolean) => set({ showAbout: value }),

  loadDeletedSessions: async (projectId?: string | null) => {
    const pid = projectId !== undefined ? projectId : get().selectedProjectId;
    const deleted = await invoke<import("./types").SessionSummary[]>("get_deleted_sessions", {
      projectId: pid ?? null,
    });
    set({ deletedSessions: deleted });
  },

  toggleShowDeleted: () => {
    set(state => ({ showDeleted: !state.showDeleted }));
  },

  restoreSession: async (sessionId: string, projectId: string) => {
    await invoke("restore_session", { sessionId, projectId });
    const updatedDeleted = get().deletedSessions.filter(s => s.sessionId !== sessionId);
    // 복구 후 숨겨진 세션이 0개면 자동으로 일반 모드로 복귀
    set({ deletedSessions: updatedDeleted, showDeleted: updatedDeleted.length > 0 });
    const { loadProjects, loadSessions, selectedProjectId } = get();
    await loadProjects();
    await loadSessions(selectedProjectId);
  },

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    localStorage.setItem("sidebarCollapsed", String(next));
    set({ sidebarCollapsed: next });
  },

  moveSelection: (delta: number) => {
    const { sessions, selectedIndex } = get();
    const newIndex = Math.max(0, Math.min(sessions.length - 1, selectedIndex + delta));
    set({ selectedIndex: newIndex });

    const session = sessions[newIndex];
    if (session) {
      get().selectSession(session.sessionId, session.projectId);
    }
  },

  resumeSession: async (sessionId: string, cwd: string) => {
    try {
      await invoke("resume_session", { sessionId, cwd, terminal: get().terminalApp });
    } catch (e) {
      alert(`Resume failed: ${e}`);
    }
  },

  setTerminalApp: (app: 'iterm2' | 'cmux') => {
    localStorage.setItem("terminalApp", app);
    set({ terminalApp: app });
  },

  toggleBookmark: async (sessionId: string) => {
    await invoke<boolean>("toggle_bookmark", { sessionId });
    await get().loadSessions(get().selectedProjectId);
  },

  addTag: async (sessionId: string, tag: string) => {
    await invoke("add_tag", { sessionId, tag });
    await get().loadProjects();
    await get().loadSessions(get().selectedProjectId);
    if (get().selectedSessionId === sessionId) {
      const session = get().sessions.find((s) => s.sessionId === sessionId);
      if (session) {
        set({
          sessionDetail: get().sessionDetail,
        });
      }
    }
  },

  removeTag: async (sessionId: string, tag: string) => {
    await invoke("remove_tag", { sessionId, tag });
    await get().loadProjects();
    await get().loadSessions(get().selectedProjectId);
  },

  searchSessions: async (query: string) => {
    set({ isLoading: true });
    const raw = await invoke<SessionSummary[]>("search_sessions", { query });
    set({ sessions: sortSessions(raw, get().pinRenamed), isLoading: false, selectedIndex: 0 });
  },
}));

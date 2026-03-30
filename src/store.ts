import { create } from "zustand";
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
  refresh: () => Promise<void>;
  deleteSession: (sessionId: string, projectId: string) => Promise<void>;
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

  loadProjects: async () => {
    const projects = await invoke<Project[]>("get_projects");
    const allTags = await invoke<string[]>("get_all_tags");
    set({ projects, allTags });
  },

  loadSessions: async (projectId?: string | null) => {
    set({ isLoading: true });
    const sessions = await invoke<SessionSummary[]>("get_sessions", {
      projectId: projectId ?? null,
    });
    set({ sessions, isLoading: false, selectedIndex: 0 });
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
    });
    get().loadSessions(projectId);
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
    const { selectedSessionId, selectedProjectId } = get();
    if (selectedSessionId === sessionId) {
      set({ selectedSessionId: null, sessionDetail: null, selectedIndex: 0 });
    }
    await get().loadSessions(selectedProjectId);
    await get().loadProjects();
  },

  refresh: async () => {
    set({ isLoading: true });
    await invoke("refresh_sessions");
    await get().loadProjects();
    await get().loadSessions(get().selectedProjectId);
    set({ isLoading: false });
  },

  setTheme: (themeId: string) => {
    const theme = themes.find((t) => t.id === themeId) ?? themes[0];
    localStorage.setItem("theme", theme.id);
    applyTheme(theme);
    set({ theme });
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
    await invoke("resume_session", { sessionId, cwd });
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
    const sessions = await invoke<SessionSummary[]>("search_sessions", {
      query,
    });
    set({ sessions, isLoading: false, selectedIndex: 0 });
  },
}));

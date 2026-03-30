export interface Project {
  id: string;
  name: string;
  path: string;
  sessionCount: number;
}

export interface SessionSummary {
  sessionId: string;
  projectId: string;
  projectName: string;
  cwd: string;
  title: string;
  startedAt: number;
  messageCount: number;
  humanMessageCount: number;
  toolUseCount: number;
  isBookmarked: boolean;
  tags: string[];
}

export interface SessionDetail {
  sessionId: string;
  messages: Message[];
}

export interface Message {
  msgType: MessageType;
  content: string;
  timestamp: string | null;
  toolName: string | null;
  toolInputPreview: string | null;
}

export type MessageType =
  | "user"
  | "assistant"
  | "toolUse"
  | "toolResult"
  | "system";

import type { AiTool } from './common.js';

export interface SessionSummary {
  id: string;
  tool: AiTool;
  title: string;
  projectPath: string;
  createdAt?: string;
  updatedAt?: string;
  sourcePath: string;
  messageCount: number;
  preview: string;
}

export interface SessionMessage {
  id: string;
  role: string;
  content: string;
  timestamp?: string;
  raw: unknown;
}

export interface SessionDetail extends SessionSummary {
  messages: SessionMessage[];
}

export interface DeleteSessionResponse {
  id: string;
  tool: AiTool;
  trashId: string;
  removedPaths: string[];
  updatedPaths: string[];
  backupDir: string;
}

export interface SessionsQuery {
  tool?: AiTool;
  keyword?: string;
  projectPath?: string;
  startAt?: string;
  endAt?: string;
  page?: number;
  pageSize?: number;
}

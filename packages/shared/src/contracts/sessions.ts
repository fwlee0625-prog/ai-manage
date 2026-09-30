import type { AiTool } from './common.js';
import type { SessionUsage } from './statistics.js';

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
  /** Token 用量与工具调用统计（旧索引数据或解析失败时缺省）。 */
  usage?: SessionUsage;
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

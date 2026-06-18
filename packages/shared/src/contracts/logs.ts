import type { AiTool } from './common.js';

export interface LogEntry {
  id: string;
  tool: AiTool;
  timestamp?: string;
  level: string;
  target?: string;
  threadId?: string;
  message: string;
  raw?: unknown;
}

import type { AiTool } from './common.js';

export type TerminalSessionStatus = 'running' | 'exited' | 'closed';

export interface CreateTerminalSessionRequest {
  /** AI tool command to launch in a project pseudo terminal. */
  tool: AiTool;
  /** Exact indexed project path used as the PTY working directory. */
  projectPath: string;
  /** Existing conversation id to resume instead of starting a new conversation. */
  resumeSessionId?: string;
  /** Initial terminal column count. */
  cols?: number;
  /** Initial terminal row count. */
  rows?: number;
}

export interface TerminalSessionSummary {
  /** Backend generated terminal session identifier. */
  id: string;
  tool: AiTool;
  projectPath: string;
  projectName: string;
  /** Existing conversation id this terminal continues, omitted for new conversations. */
  resumeSessionId?: string;
  status: TerminalSessionStatus;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number;
}

export interface CloseTerminalSessionResponse {
  id: string;
  status: TerminalSessionStatus;
}

export type TerminalClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number };

export type TerminalServerMessage =
  | { type: 'ready'; session: TerminalSessionSummary }
  | { type: 'output'; data: string }
  | { type: 'exit'; session: TerminalSessionSummary }
  | { type: 'error'; message: string };

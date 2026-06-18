import type { AiTool } from './common.js';

export interface ScanStatus {
  tool: AiTool;
  rootPath: string;
  available: boolean;
  lastIndexedAt?: string;
  sessionCount: number;
  configFileCount: number;
  error?: string;
}

export interface ToolStatus {
  tools: ScanStatus[];
}

export interface IndexStatus {
  statuses: ScanStatus[];
}

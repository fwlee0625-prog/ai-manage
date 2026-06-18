import type { AiTool } from './common.js';

export type TrashSessionFileOperation = 'removed-file' | 'updated-jsonl' | 'metadata';

export interface TrashSessionFile {
  name: string;
  operation: TrashSessionFileOperation;
  backupPath: string;
  originalPath?: string;
  removedLines?: string[];
}

export interface TrashSessionManifest {
  trashId: string;
  id: string;
  tool: AiTool;
  title: string;
  projectPath: string;
  sourcePath: string;
  deletedAt: string;
  backupDir: string;
  removedPaths: string[];
  updatedPaths: string[];
  files: TrashSessionFile[];
}

export interface TrashSessionSummary {
  trashId: string;
  id: string;
  tool: AiTool;
  title: string;
  projectPath: string;
  sourcePath: string;
  deletedAt: string;
  backupDir: string;
  removedPaths: string[];
  updatedPaths: string[];
  fileCount: number;
  restorable: boolean;
}

export interface TrashSessionDetail extends TrashSessionSummary {
  files: TrashSessionFile[];
}

export interface TrashSessionFilePreview {
  trashId: string;
  index: number;
  name: string;
  backupPath: string;
  size: number;
  previewType: 'text' | 'json' | 'unsupported';
  content?: string;
  supported: boolean;
  reason?: string;
}

export interface RestoreTrashSessionResponse {
  trashId: string;
  id: string;
  tool: AiTool;
  restoredPaths: string[];
  updatedPaths: string[];
}

export interface ClearTrashSessionsResponse {
  deletedCount: number;
}

import type { AiTool } from './common.js';

export type ToolFileKind = 'directory' | 'file' | 'symlink';

export interface ToolFileEntry {
  tool: AiTool;
  name: string;
  path: string;
  kind: ToolFileKind;
  size: number;
  updatedAt?: string;
  extension?: string;
}

export interface ToolFileBreadcrumb {
  name: string;
  path: string;
}

export interface ToolDirectoryListing {
  tool: AiTool;
  rootPath: string;
  path: string;
  breadcrumbs: ToolFileBreadcrumb[];
  entries: ToolFileEntry[];
}

export type ToolFilePreviewType = 'text' | 'json' | 'markdown' | 'image' | 'unsupported';

export interface ToolFilePreview {
  tool: AiTool;
  name: string;
  path: string;
  size: number;
  updatedAt?: string;
  previewType: ToolFilePreviewType;
  mimeType?: string;
  content?: string;
  supported: boolean;
  reason?: string;
}

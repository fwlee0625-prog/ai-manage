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

export type ToolFilePreviewType = 'text' | 'json' | 'markdown' | 'image' | 'sqlite' | 'unsupported';

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

/** One user table or view inside a SQLite file. */
export interface SqliteTableSummary {
  name: string;
  kind: 'table' | 'view';
  rowCount: number;
}

/** One column of a SQLite table or view. */
export interface SqliteColumnSummary {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
}

/** One paged data row; BLOB values are rendered as readable byte summaries. */
export type SqliteCellValue = string | number | boolean | null;

export interface SqliteTableRows {
  tool: AiTool;
  path: string;
  table: string;
  page: number;
  pageSize: number;
  total: number;
  columns: SqliteColumnSummary[];
  rows: Record<string, SqliteCellValue>[];
}

/** Overview payload for the SQLite preview entry screen. */
export interface SqliteFileOverview {
  tool: AiTool;
  name: string;
  path: string;
  size: number;
  updatedAt?: string;
  tables: SqliteTableSummary[];
}

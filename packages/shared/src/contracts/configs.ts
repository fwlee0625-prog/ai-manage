import type { AiTool } from './common.js';

export type ConfigFileCategory = 'config' | 'instruction' | 'index' | 'history' | 'runtime' | 'cache';
export type ConfigFormKind = 'toml-config' | 'json-config' | 'markdown-instruction' | 'readonly';

export interface ConfigFileSummary {
  id: string;
  tool: AiTool;
  name: string;
  path: string;
  format: 'json' | 'toml' | 'markdown' | 'jsonl' | 'text';
  size: number;
  updatedAt?: string;
  category: ConfigFileCategory;
  editable: boolean;
  formKind: ConfigFormKind;
  hiddenFromConfigPage: boolean;
}

export interface ConfigFileDetail extends ConfigFileSummary {
  raw: string;
  parsed?: unknown;
  hash: string;
  formModel?: unknown;
}

export interface SaveConfigFileRequest {
  expectedHash: string;
  mode: 'parsed' | 'raw';
  parsed?: unknown;
  raw?: string;
}

export interface SaveConfigFileResponse {
  detail: ConfigFileDetail;
  backupPath: string;
}

export interface ReplaceCodexOpenAiApiKeyRequest {
  openaiApiKey: string;
}

export interface ReplaceCodexOpenAiApiKeyResponse {
  backupPath?: string;
}

export interface CodexOpenAiApiKeyResponse {
  openaiApiKey: string;
  exists: boolean;
}

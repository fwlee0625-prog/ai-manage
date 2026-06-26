import type { AiTool } from './common.js';

export type SkillSource = AiTool;
export type SkillScope = 'system' | 'project';

export interface SkillSummary {
  id: string;
  source: SkillSource;
  /** Whether the skill is from the tool-level root or from an indexed project. */
  scope: SkillScope;
  name: string;
  path: string;
  skillFilePath: string;
  description: string;
  system: boolean;
  projectPath?: string;
  projectName?: string;
  size: number;
  updatedAt?: string;
}

export interface SkillDetail extends SkillSummary {
  raw: string;
  hash: string;
}

export interface SaveSkillRequest {
  expectedHash: string;
  raw: string;
}

export interface SaveSkillResponse {
  detail: SkillDetail;
  backupPath: string;
}

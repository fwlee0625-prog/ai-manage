import type { AiTool } from './common.js';

export type SkillSource = AiTool;
export type SkillScope = 'system' | 'project' | 'local';

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
  /** Stable id of the source skill when this item is a local favorite copy. */
  originSkillId?: string;
  /** Time when this skill was copied into the local favorites directory. */
  favoritedAt?: string;
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

export interface FavoriteSkillResponse {
  skill: SkillSummary;
  localPath: string;
}

export interface UnfavoriteSkillResponse {
  originSkillId: string;
  localPath: string;
}

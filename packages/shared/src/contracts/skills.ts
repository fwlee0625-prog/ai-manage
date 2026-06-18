export type SkillSource = 'codex' | 'agents';

export interface SkillSummary {
  id: string;
  source: SkillSource;
  name: string;
  path: string;
  skillFilePath: string;
  description: string;
  system: boolean;
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

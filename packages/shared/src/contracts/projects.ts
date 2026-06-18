import type { AiTool } from './common.js';

export interface ProjectSummary {
  tool: AiTool;
  projectPath: string;
  projectName: string;
  sessionCount: number;
  latestUpdatedAt?: string;
}

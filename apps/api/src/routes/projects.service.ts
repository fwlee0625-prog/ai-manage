import { Injectable } from '@nestjs/common';
import type { AiTool, ProjectSummary } from '@ai-manage/shared';
import { IndexRepository } from '../database/index.repository.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly index: IndexRepository) {}

  /** Lists project aggregates from the full session index. */
  projects(tool?: AiTool): Promise<ProjectSummary[]> {
    return this.index.listProjects(tool);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import type { AiTool } from '@ai-manage/shared';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  /** Lists project aggregates from the full session index. */
  @Get()
  projects(@Query('tool') tool?: AiTool) {
    return this.service.projects(tool);
  }
}

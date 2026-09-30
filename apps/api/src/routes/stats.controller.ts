import { Controller, Get, Query } from '@nestjs/common';
import type { AiTool } from '@ai-manage/shared';
import { StatsService } from './stats.service.js';

@Controller('stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  /** Global token usage and tool call overview, optional per tool. */
  @Get('overview')
  overview(@Query('tool') tool?: AiTool) {
    return this.service.overview(tool);
  }

  /** Per-project usage stats sorted by total tokens, optional per tool. */
  @Get('projects')
  projects(@Query('tool') tool?: AiTool) {
    return this.service.projects(tool);
  }

  /** Daily usage trend, optional per tool/project. */
  @Get('daily')
  daily(
    @Query('tool') tool?: AiTool,
    @Query('projectPath') projectPath?: string,
    @Query('days') days?: string,
  ) {
    return this.service.daily({
      ...(tool ? { tool } : {}),
      ...(projectPath ? { projectPath } : {}),
      ...(days ? { days: Number(days) } : {}),
    });
  }
}

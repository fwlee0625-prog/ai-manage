import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { AiTool } from '@ai-manage/shared';
import { IndexRefreshService } from './index-refresh.service.js';
import { IndexingService } from '../indexing/indexing.service.js';

@Controller('index')
export class IndexingController {
  constructor(
    private readonly service: IndexRefreshService,
    private readonly indexing: IndexingService,
  ) {}

  /** Returns the persisted index status snapshot for one tool or all tools. */
  @Get('status')
  status(@Query('tool') tool?: AiTool) {
    return this.indexing.statuses(tool);
  }

  /** Refreshes the session index for one tool or all tools. */
  @Post('refresh')
  refresh(@Body('tool') tool?: AiTool) {
    return this.service.refresh(tool);
  }
}

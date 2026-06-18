import { Controller, Get, Query } from '@nestjs/common';
import type { AiTool } from '@ai-manage/shared';
import { LogsService } from './logs.service.js';

@Controller('logs')
export class LogsController {
  constructor(private readonly service: LogsService) {}

  /** Lists recent runtime logs for a supported tool. */
  @Get()
  logs(@Query('tool') tool?: AiTool, @Query('limit') limit?: string) {
    return this.service.logs(tool, Number(limit || 100));
  }
}

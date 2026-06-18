import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import type { AiTool, SessionsQuery } from '@ai-manage/shared';
import { SessionsService } from './sessions.service.js';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  /** Lists indexed sessions with pagination and filters. */
  @Get()
  sessions(@Query() query: SessionsQuery) {
    return this.service.sessions(query);
  }

  /** Reads a single session detail from the owning tool. */
  @Get(':tool/:id')
  session(@Param('tool') tool: AiTool, @Param('id') id: string) {
    return this.service.session(tool, id);
  }

  /** Deletes a session from the owning tool after writing a trash backup. */
  @Delete(':tool/:id')
  deleteSession(@Param('tool') tool: AiTool, @Param('id') id: string) {
    return this.service.deleteSession(tool, id);
  }
}

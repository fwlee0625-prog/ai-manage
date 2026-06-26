import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import type { CreateTerminalSessionRequest } from '@ai-manage/shared';
import { TerminalsService } from './terminals.service.js';

@Controller('terminals')
export class TerminalsController {
  constructor(private readonly service: TerminalsService) {}

  /** Lists PTY terminal sessions tracked by the backend process. */
  @Get()
  sessions() {
    return this.service.listSessions();
  }

  /** Starts a Codex or Claude terminal session inside an indexed project path. */
  @Post()
  createSession(@Body() body: CreateTerminalSessionRequest) {
    return this.service.createSession(body);
  }

  /** Stops one terminal session and closes its attached websocket clients. */
  @Delete(':id')
  closeSession(@Param('id') id: string) {
    return this.service.closeSession(id);
  }
}

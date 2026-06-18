import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import type { AiTool } from '@ai-manage/shared';
import { TrashService } from './trash.service.js';

@Controller('trash')
export class TrashController {
  constructor(private readonly trash: TrashService) {}

  /** Lists deleted sessions currently stored in the local trash area. */
  @Get('sessions')
  trashSessions(@Query('tool') tool?: AiTool) {
    return this.trash.sessions(tool);
  }

  /** Reads one deleted session manifest. */
  @Get('sessions/:trashId')
  trashSession(@Param('trashId') trashId: string) {
    return this.trash.session(trashId);
  }

  /** Previews one backed-up file from a deleted session manifest. */
  @Get('sessions/:trashId/files/:index/preview')
  trashFilePreview(@Param('trashId') trashId: string, @Param('index') index: string) {
    return this.trash.filePreview(trashId, Number(index));
  }

  /** Restores a deleted session from the local trash area. */
  @Post('sessions/:trashId/restore')
  restoreTrashSession(@Param('trashId') trashId: string) {
    return this.trash.restoreSession(trashId);
  }

  /** Clears deleted sessions, optionally scoped to one tool. */
  @Delete('sessions')
  clearTrashSessions(@Query('tool') tool?: AiTool) {
    return this.trash.clearSessions(tool);
  }

  /** Permanently removes one deleted session backup. */
  @Delete('sessions/:trashId')
  deleteTrashSession(@Param('trashId') trashId: string) {
    return this.trash.deleteSession(trashId);
  }
}

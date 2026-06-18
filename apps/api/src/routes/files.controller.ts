import { Controller, Get, Query } from '@nestjs/common';
import type { AiTool } from '@ai-manage/shared';
import { FilesService } from './files.service.js';

@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  /** Lists a directory inside one AI tool root. */
  @Get()
  files(@Query('tool') tool?: AiTool, @Query('path') path?: string) {
    return this.service.files(tool, path);
  }

  /** Returns a supported preview for one file inside a tool root. */
  @Get('preview')
  filePreview(@Query('tool') tool?: AiTool, @Query('path') path?: string) {
    return this.service.filePreview(tool, path);
  }
}

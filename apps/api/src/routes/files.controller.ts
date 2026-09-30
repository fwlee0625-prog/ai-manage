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

  /** Returns the table list of a SQLite file inside a tool root. */
  @Get('sqlite/overview')
  sqliteOverview(@Query('tool') tool?: AiTool, @Query('path') path?: string) {
    return this.service.sqliteOverview(tool, path);
  }

  /** Returns one page of rows from a SQLite table or view. */
  @Get('sqlite/rows')
  sqliteRows(
    @Query('tool') tool?: AiTool,
    @Query('path') path?: string,
    @Query('table') table?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.sqliteRows(
      tool,
      path,
      table ?? '',
      Number.parseInt(page ?? '', 10) || 1,
      Number.parseInt(pageSize ?? '', 10) || 50,
    );
  }
}

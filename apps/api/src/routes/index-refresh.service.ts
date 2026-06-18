import { Injectable } from '@nestjs/common';
import type { AiTool } from '@ai-manage/shared';
import { IndexingService } from '../indexing/indexing.service.js';

@Injectable()
export class IndexRefreshService {
  constructor(private readonly indexing: IndexingService) {}

  /** Refreshes one tool index or all tool indexes. */
  async refresh(tool?: AiTool) {
    if (tool) return [await this.indexing.refreshTool(tool)];
    return this.indexing.refreshAll();
  }
}

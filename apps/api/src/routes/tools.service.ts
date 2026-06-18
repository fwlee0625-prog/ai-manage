import { Injectable } from '@nestjs/common';
import type { ToolStatus } from '@ai-manage/shared';
import { AdapterRegistry } from '../adapters/adapter-registry.js';
import { IndexRepository } from '../database/index.repository.js';

@Injectable()
export class ToolsService {
  constructor(
    private readonly adapters: AdapterRegistry,
    private readonly index: IndexRepository,
  ) {}

  /** Returns indexed status and live availability for every supported tool. */
  async tools(): Promise<ToolStatus> {
    const existing = await this.index.statuses();
    const byTool = new Map(existing.map(status => [status.tool, status]));
    return {
      tools: this.adapters.all().map(adapter => byTool.get(adapter.tool) || {
        tool: adapter.tool,
        rootPath: adapter.rootPath,
        available: adapter.isAvailable(),
        sessionCount: 0,
        configFileCount: 0,
      }),
    };
  }
}

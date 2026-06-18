import { Injectable } from '@nestjs/common';
import type { AiTool, IndexStatus, ScanStatus } from '@ai-manage/shared';
import { AdapterRegistry } from '../adapters/adapter-registry.js';
import { IndexRepository } from '../database/index.repository.js';

@Injectable()
export class IndexingService {
  constructor(
    private readonly adapters: AdapterRegistry,
    private readonly index: IndexRepository,
  ) {}

  async statuses(tool?: AiTool): Promise<IndexStatus> {
    const statuses = await this.index.statuses();
    return {
      statuses: tool ? statuses.filter(status => status.tool === tool) : statuses,
    };
  }

  async refreshAll(): Promise<ScanStatus[]> {
    const statuses: ScanStatus[] = [];
    for (const adapter of this.adapters.all()) {
      statuses.push(await this.refreshTool(adapter.tool));
    }
    return statuses;
  }

  async refreshTool(tool: AiTool): Promise<ScanStatus> {
    const adapter = this.adapters.get(tool);
    if (!adapter) throw new Error(`Unsupported tool: ${tool}`);

    if (!adapter.isAvailable()) {
      const status: ScanStatus = {
        tool,
        rootPath: adapter.rootPath,
        available: false,
        lastIndexedAt: new Date().toISOString(),
        sessionCount: 0,
        configFileCount: 0,
        error: 'Tool directory does not exist',
      };
      await this.index.replaceToolSessions(tool, []);
      await this.index.upsertStatus(status);
      return status;
    }

    try {
      const [sessions, configFiles] = await Promise.all([
        adapter.scanSessions(),
        adapter.listConfigFiles(),
      ]);
      await this.index.replaceToolSessions(tool, sessions);
      const status: ScanStatus = {
        tool,
        rootPath: adapter.rootPath,
        available: true,
        lastIndexedAt: new Date().toISOString(),
        sessionCount: sessions.length,
        configFileCount: configFiles.filter(file => !file.hiddenFromConfigPage).length,
      };
      await this.index.upsertStatus(status);
      return status;
    } catch (error) {
      const status: ScanStatus = {
        tool,
        rootPath: adapter.rootPath,
        available: true,
        lastIndexedAt: new Date().toISOString(),
        sessionCount: 0,
        configFileCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
      await this.index.upsertStatus(status);
      return status;
    }
  }
}

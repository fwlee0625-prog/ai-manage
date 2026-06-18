import { Injectable, NotFoundException } from '@nestjs/common';
import type { AiTool, LogEntry } from '@ai-manage/shared';
import { AdapterRegistry } from '../adapters/adapter-registry.js';

@Injectable()
export class LogsService {
  constructor(private readonly adapters: AdapterRegistry) {}

  /** Reads recent logs from one tool or all tools. */
  async logs(tool?: AiTool, limit = 100): Promise<LogEntry[]> {
    const adapters = tool ? [this.requireAdapter(tool)] : this.adapters.all();
    const nested = await Promise.all(adapters.map(adapter => adapter.readLogs(limit)));
    return nested.flat();
  }

  private requireAdapter(tool: AiTool) {
    const adapter = this.adapters.get(tool);
    if (!adapter) throw new NotFoundException(`Unsupported tool: ${tool}`);
    return adapter;
  }
}

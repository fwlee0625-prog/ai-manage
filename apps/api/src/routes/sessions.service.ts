import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AiTool,
  DeleteSessionResponse,
  PaginatedResult,
  SessionDetail,
  SessionSummary,
  SessionsQuery,
} from '@ai-manage/shared';
import { AdapterRegistry } from '../adapters/adapter-registry.js';
import { IndexRepository } from '../database/index.repository.js';

@Injectable()
export class SessionsService {
  constructor(
    private readonly adapters: AdapterRegistry,
    private readonly index: IndexRepository,
  ) {}

  /** Lists indexed session summaries with filters and pagination. */
  sessions(query: SessionsQuery): Promise<PaginatedResult<SessionSummary>> {
    return this.index.findSessions(query);
  }

  /** Reads session details from the owning AI tool adapter. */
  async session(tool: AiTool, id: string): Promise<SessionDetail> {
    const summary = await this.index.getSession(tool, id);
    if (!summary) throw new NotFoundException('Session not found');
    return this.requireAdapter(tool).readSession(summary);
  }

  /** Deletes a session and updates index aggregates after adapter deletion. */
  async deleteSession(tool: AiTool, id: string): Promise<DeleteSessionResponse> {
    const summary = await this.index.getSession(tool, id);
    if (!summary) throw new NotFoundException('Session not found');
    const result = await this.requireAdapter(tool).deleteSession(summary);
    await this.index.deleteSession(tool, id);
    await this.index.refreshSessionCount(tool);
    return result;
  }

  private requireAdapter(tool: AiTool) {
    const adapter = this.adapters.get(tool);
    if (!adapter) throw new NotFoundException(`Unsupported tool: ${tool}`);
    return adapter;
  }
}

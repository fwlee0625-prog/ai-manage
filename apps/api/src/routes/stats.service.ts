import { Injectable } from '@nestjs/common';
import type { AiTool, DailyUsagePoint, DailyUsageQuery, ProjectUsageStats, UsageOverview, UsageTotals } from '@ai-manage/shared';
import { IndexRepository } from '../database/index.repository.js';

@Injectable()
export class StatsService {
  constructor(private readonly index: IndexRepository) {}

  /**
   * Aggregates the global usage overview by reducing per-project stats.
   *
   * 复用 {@link IndexRepository.listProjectUsage} 的聚合结果在内存归约，
   * 避免为总览单独维护一套 SQL。
   */
  async overview(tool?: AiTool): Promise<UsageOverview> {
    const projects = await this.index.listProjectUsage(tool);
    const totals = emptyTotals();
    const toolCallBreakdown: Record<string, number> = {};
    let sessionCount = 0;
    let latestUpdatedAt: string | undefined;
    for (const project of projects) {
      sessionCount += project.sessionCount;
      totals.inputTokens += project.usage.inputTokens;
      totals.cacheReadTokens += project.usage.cacheReadTokens;
      totals.cacheWriteTokens += project.usage.cacheWriteTokens;
      totals.outputTokens += project.usage.outputTokens;
      totals.totalTokens += project.usage.totalTokens;
      totals.toolCallCount += project.usage.toolCallCount;
      for (const [name, count] of Object.entries(project.toolCallBreakdown)) {
        toolCallBreakdown[name] = (toolCallBreakdown[name] || 0) + count;
      }
      if (project.latestUpdatedAt && (!latestUpdatedAt || project.latestUpdatedAt > latestUpdatedAt)) {
        latestUpdatedAt = project.latestUpdatedAt;
      }
    }
    return {
      ...(tool ? { tool } : {}),
      projectCount: projects.length,
      sessionCount,
      totals,
      toolCallBreakdown,
      ...(latestUpdatedAt ? { latestUpdatedAt } : {}),
    };
  }

  /** Lists per-project usage stats sorted by total tokens. */
  projects(tool?: AiTool): Promise<ProjectUsageStats[]> {
    return this.index.listProjectUsage(tool);
  }

  /** Aggregates per-day usage for the requested tool/project scope. */
  daily(query: DailyUsageQuery): Promise<DailyUsagePoint[]> {
    return this.index.dailyUsage(query.tool, query.projectPath, query.days);
  }
}

/** Creates a zeroed {@link UsageTotals} accumulator. */
function emptyTotals(): UsageTotals {
  return {
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    toolCallCount: 0,
  };
}

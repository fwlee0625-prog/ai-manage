import { Injectable, OnModuleInit } from '@nestjs/common';
import type { AiTool, DailyUsagePoint, PaginatedResult, ProjectSummary, ProjectUsageStats, ScanStatus, SessionSummary, SessionUsage, SessionsQuery } from '@ai-manage/shared';
import { resolve } from 'node:path';
import { DATA_DIR } from '../utils.js';
import { INDEX_MIGRATIONS, migrationInsertStatement } from './index.migrations.js';
import {
  SESSION_SELECT_COLUMNS,
  buildSessionQuerySql,
  conditionsToWhereClause,
  projectWhereClause,
  sessionIdentityWhereClause,
  toolWhereClause,
} from './index.queries.js';
import { SqliteDatabase, sqlString } from './sqlite-database.js';

interface SessionRow {
  id: string;
  tool: AiTool;
  title: string;
  projectPath: string;
  createdAt?: string;
  updatedAt?: string;
  sourcePath: string;
  messageCount: number;
  preview: string;
  inputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  toolCallCount?: number;
  toolCallsJson?: string;
  modelsJson?: string;
  model?: string;
}

@Injectable()
export class IndexRepository implements OnModuleInit {
  private sqlite = new SqliteDatabase(resolve(DATA_DIR, 'index.sqlite'));

  static forDatabase(dbPath: string): IndexRepository {
    const repository = new IndexRepository();
    repository.sqlite = new SqliteDatabase(dbPath);
    return repository;
  }

  async onModuleInit() {
    await this.init();
  }

  async init(): Promise<void> {
    await this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    const applied = await this.sqlite.all<{ version: number }>('SELECT version FROM schema_migrations;');
    const appliedVersions = new Set(applied.map(row => Number(row.version)));
    for (const migration of INDEX_MIGRATIONS) {
      if (appliedVersions.has(migration.version)) continue;
      await this.sqlite.transaction([
        migration.sql,
        migrationInsertStatement(migration),
      ]);
    }
  }

  async appliedMigrationVersions(): Promise<number[]> {
    await this.init();
    const rows = await this.sqlite.all<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version;');
    return rows.map(row => Number(row.version));
  }

  async replaceToolSessions(tool: AiTool, sessions: SessionSummary[]): Promise<void> {
    await this.init();
    const statements = [`DELETE FROM sessions WHERE tool = ${sqlString(tool)};`];
    for (const batch of this.chunk(sessions, 200)) {
      statements.push(...batch.map(session => {
        const searchText = [session.title, session.projectPath, session.preview, session.sourcePath].join('\n');
        const usage = session.usage;
        return `
          INSERT OR REPLACE INTO sessions (
            id, tool, title, project_path, created_at, updated_at, source_path, message_count, preview, search_text,
            input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, total_tokens, tool_call_count, tool_calls_json, models_json, model
          ) VALUES (
            ${sqlString(session.id)},
            ${sqlString(session.tool)},
            ${sqlString(session.title)},
            ${sqlString(session.projectPath)},
            ${sqlString(session.createdAt)},
            ${sqlString(session.updatedAt)},
            ${sqlString(session.sourcePath)},
            ${Number(session.messageCount || 0)},
            ${sqlString(session.preview)},
            ${sqlString(searchText)},
            ${Number(usage?.inputTokens || 0)},
            ${Number(usage?.cacheReadTokens || 0)},
            ${Number(usage?.cacheWriteTokens || 0)},
            ${Number(usage?.outputTokens || 0)},
            ${Number(usage?.totalTokens || 0)},
            ${Number(usage?.toolCallCount || 0)},
            ${usage ? sqlString(JSON.stringify(usage.toolCallBreakdown || {})) : 'NULL'},
            ${usage ? sqlString(JSON.stringify(usage.models || [])) : 'NULL'},
            ${usage?.model ? sqlString(usage.model) : 'NULL'}
          );
        `;
      }));
    }
    await this.sqlite.transaction(statements);
  }

  async upsertStatus(status: ScanStatus): Promise<void> {
    await this.init();
    await this.sqlite.exec(`
      INSERT INTO scan_status (
        tool, root_path, available, last_indexed_at, session_count, config_file_count, error
      ) VALUES (
        ${sqlString(status.tool)},
        ${sqlString(status.rootPath)},
        ${status.available ? 1 : 0},
        ${sqlString(status.lastIndexedAt)},
        ${status.sessionCount},
        ${status.configFileCount},
        ${sqlString(status.error)}
      )
      ON CONFLICT(tool) DO UPDATE SET
        root_path = excluded.root_path,
        available = excluded.available,
        last_indexed_at = excluded.last_indexed_at,
        session_count = excluded.session_count,
        config_file_count = excluded.config_file_count,
        error = excluded.error;
    `);
  }

  async statuses(): Promise<ScanStatus[]> {
    await this.init();
    const rows = await this.sqlite.all<{
      tool: AiTool;
      root_path: string;
      available: number;
      last_indexed_at?: string;
      session_count: number;
      config_file_count: number;
      error?: string;
    }>('SELECT * FROM scan_status ORDER BY tool;');
    return rows.map(row => ({
      tool: row.tool,
      rootPath: row.root_path,
      available: row.available === 1,
      lastIndexedAt: row.last_indexed_at,
      sessionCount: row.session_count,
      configFileCount: row.config_file_count,
      error: row.error,
    }));
  }

  async findSessions(query: SessionsQuery): Promise<PaginatedResult<SessionSummary>> {
    await this.init();
    const sessionQuery = buildSessionQuerySql(query);
    const { where } = sessionQuery;
    const countRows = await this.sqlite.all<{ total: number }>(`SELECT COUNT(*) AS total FROM sessions ${where};`);
    const rows = await this.sqlite.all<SessionRow>(`
      SELECT ${SESSION_SELECT_COLUMNS}
      FROM sessions
      ${where}
      ORDER BY datetime(updated_at) DESC NULLS LAST, title ASC
      LIMIT ${sessionQuery.limit}
      OFFSET ${sessionQuery.offset};
    `);
    return {
      items: rows.map(row => this.toSessionSummary(row)),
      total: countRows[0]?.total || 0,
      page: sessionQuery.page,
      pageSize: sessionQuery.pageSize,
    };
  }

  /**
   * Aggregates per-project token usage and tool call stats from the session index.
   *
   * 数值列用 SQL SUM 聚合；工具调用分布存在每行的 `tool_calls_json` 里，
   * 用一次轻量查询取回后在内存中按项目合并。结果按 `SUM(total_tokens)` 降序。
   */
  async listProjectUsage(tool?: AiTool): Promise<ProjectUsageStats[]> {
    await this.init();
    const where = projectWhereClause(tool);
    const rows = await this.sqlite.all<{
      tool: AiTool;
      projectPath: string;
      sessionCount: number;
      latestUpdatedAt?: string;
      inputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      outputTokens: number;
      totalTokens: number;
      toolCallCount: number;
    }>(`
      SELECT
        tool,
        project_path AS projectPath,
        COUNT(*) AS sessionCount,
        MAX(updated_at) AS latestUpdatedAt,
        SUM(input_tokens) AS inputTokens,
        SUM(cache_read_tokens) AS cacheReadTokens,
        SUM(cache_write_tokens) AS cacheWriteTokens,
        SUM(output_tokens) AS outputTokens,
        SUM(total_tokens) AS totalTokens,
        SUM(tool_call_count) AS toolCallCount
      FROM sessions
      ${where}
      GROUP BY tool, project_path
      ORDER BY SUM(total_tokens) DESC, sessionCount DESC, projectPath ASC;
    `);
    const breakdownRows = await this.sqlite.all<{ tool: AiTool; projectPath: string; toolCallsJson?: string }>(`
      SELECT tool, project_path AS projectPath, tool_calls_json AS toolCallsJson
      FROM sessions
      ${where};
    `);
    const breakdowns = new Map<string, Record<string, number>>();
    for (const row of breakdownRows) {
      const key = projectKey(row.tool, row.projectPath);
      const bucket = breakdowns.get(key) || {};
      for (const [name, count] of Object.entries(parseBreakdown(row.toolCallsJson))) {
        bucket[name] = (bucket[name] || 0) + count;
      }
      breakdowns.set(key, bucket);
    }
    return rows.map(row => ({
      tool: row.tool,
      projectPath: row.projectPath,
      projectName: this.projectNameFromPath(row.projectPath),
      sessionCount: Number(row.sessionCount || 0),
      latestUpdatedAt: row.latestUpdatedAt,
      usage: {
        inputTokens: Number(row.inputTokens || 0),
        cacheReadTokens: Number(row.cacheReadTokens || 0),
        cacheWriteTokens: Number(row.cacheWriteTokens || 0),
        outputTokens: Number(row.outputTokens || 0),
        totalTokens: Number(row.totalTokens || 0),
        toolCallCount: Number(row.toolCallCount || 0),
      },
      toolCallBreakdown: breakdowns.get(projectKey(row.tool, row.projectPath)) || {},
    }));
  }

  /**
   * Aggregates token usage per day for the most recent `days` days, ascending by date.
   *
   * 会话用量按其 `updated_at` 归入当天；`days` 夹取 1~180。
   */
  async dailyUsage(tool?: AiTool, projectPath?: string, days = 30): Promise<DailyUsagePoint[]> {
    await this.init();
    const boundedDays = clampDays(days);
    const conditions: string[] = ['updated_at IS NOT NULL'];
    if (tool) conditions.push(`tool = ${sqlString(tool)}`);
    if (projectPath) conditions.push(`project_path = ${sqlString(projectPath)}`);
    conditions.push(`date(updated_at) >= date('now', '-${boundedDays} day')`);
    const rows = await this.sqlite.all<{
      date: string;
      sessionCount: number;
      inputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      outputTokens: number;
      totalTokens: number;
      toolCallCount: number;
    }>(`
      SELECT
        date(updated_at) AS date,
        COUNT(*) AS sessionCount,
        SUM(input_tokens) AS inputTokens,
        SUM(cache_read_tokens) AS cacheReadTokens,
        SUM(cache_write_tokens) AS cacheWriteTokens,
        SUM(output_tokens) AS outputTokens,
        SUM(total_tokens) AS totalTokens,
        SUM(tool_call_count) AS toolCallCount
      FROM sessions
      ${conditionsToWhereClause(conditions)}
      GROUP BY date(updated_at)
      ORDER BY date ASC;
    `);
    return rows.map(row => ({
      date: row.date,
      sessionCount: Number(row.sessionCount || 0),
      inputTokens: Number(row.inputTokens || 0),
      cacheReadTokens: Number(row.cacheReadTokens || 0),
      cacheWriteTokens: Number(row.cacheWriteTokens || 0),
      outputTokens: Number(row.outputTokens || 0),
      totalTokens: Number(row.totalTokens || 0),
      toolCallCount: Number(row.toolCallCount || 0),
    }));
  }

  async listProjects(tool?: AiTool): Promise<ProjectSummary[]> {
    await this.init();
    const where = projectWhereClause(tool);
    const rows = await this.sqlite.all<{
      tool: AiTool;
      projectPath: string;
      sessionCount: number;
      latestUpdatedAt?: string;
    }>(`
      SELECT
        tool,
        project_path AS projectPath,
        COUNT(*) AS sessionCount,
        MAX(updated_at) AS latestUpdatedAt
      FROM sessions
      ${where}
      GROUP BY tool, project_path
      ORDER BY datetime(latestUpdatedAt) DESC NULLS LAST, sessionCount DESC, projectPath ASC;
    `);
    return rows.map(row => ({
      tool: row.tool,
      projectPath: row.projectPath,
      projectName: this.projectNameFromPath(row.projectPath),
      sessionCount: Number(row.sessionCount || 0),
      latestUpdatedAt: row.latestUpdatedAt,
    }));
  }

  async getSession(tool: AiTool, id: string): Promise<SessionSummary | undefined> {
    const rows = await this.sqlite.all<SessionRow>(`
      SELECT ${SESSION_SELECT_COLUMNS}
      FROM sessions
      ${sessionIdentityWhereClause(tool, id)}
      LIMIT 1;
    `);
    const row = rows[0];
    return row ? this.toSessionSummary(row) : undefined;
  }

  async deleteSession(tool: AiTool, id: string): Promise<void> {
    await this.init();
    await this.sqlite.exec(`DELETE FROM sessions ${sessionIdentityWhereClause(tool, id)};`);
  }

  async refreshSessionCount(tool: AiTool): Promise<void> {
    await this.init();
    const rows = await this.sqlite.all<{ total: number }>(
      `SELECT COUNT(*) AS total FROM sessions ${toolWhereClause(tool)};`,
    );
    await this.sqlite.exec(`
      UPDATE scan_status
      SET session_count = ${Number(rows[0]?.total || 0)}
      ${toolWhereClause(tool)};
    `);
  }

  private projectNameFromPath(projectPath: string): string {
    const normalized = projectPath.trim().replace(/\/+$/, '');
    if (!normalized) return '未识别项目';
    return normalized.split('/').filter(Boolean).at(-1) || normalized;
  }

  /**
   * Maps a raw select row (with usage columns) into the shared {@link SessionSummary}.
   *
   * 用量列全为 0 时省略 `usage` 字段，保持「旧索引数据无统计」的语义。
   */
  private toSessionSummary(row: SessionRow): SessionSummary {
    const models = parseModels(row.modelsJson);
    const usage: SessionUsage = {
      inputTokens: Number(row.inputTokens || 0),
      cacheReadTokens: Number(row.cacheReadTokens || 0),
      cacheWriteTokens: Number(row.cacheWriteTokens || 0),
      outputTokens: Number(row.outputTokens || 0),
      totalTokens: Number(row.totalTokens || 0),
      toolCallCount: Number(row.toolCallCount || 0),
      toolCallBreakdown: parseBreakdown(row.toolCallsJson),
      // 旧索引没有 models_json：退回单模型列，保持「一个会话至少能展示最后模型」。
      ...(models.length ? { models } : row.model ? { models: [row.model] } : {}),
      ...(row.model ? { model: row.model } : {}),
    };
    const hasUsage = usage.totalTokens > 0 || usage.inputTokens > 0 || usage.outputTokens > 0 || usage.toolCallCount > 0;
    return {
      id: row.id,
      tool: row.tool,
      title: row.title,
      projectPath: row.projectPath,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sourcePath: row.sourcePath,
      messageCount: Number(row.messageCount || 0),
      preview: row.preview,
      ...(hasUsage ? { usage } : {}),
    };
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      batches.push(items.slice(index, index + size));
    }
    return batches;
  }
}

/** Builds the in-memory map key joining a session row to its project. */
function projectKey(tool: AiTool, projectPath: string): string {
  return `${tool}\n${projectPath}`;
}

/**
 * Safely parses a stored `tool_calls_json` cell into a per-tool counter object.
 */
function parseBreakdown(raw?: string): Record<string, number> {  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const breakdown: Record<string, number> = {};
    for (const [name, count] of Object.entries(parsed as Record<string, unknown>)) {
      const numeric = Number(count);
      if (name && Number.isFinite(numeric) && numeric > 0) breakdown[name] = Math.floor(numeric);
    }
    return breakdown;
  } catch {
    return {};
  }
}

/**
 * Safely parses a stored `models_json` cell into an ordered model name list.
 */
function parseModels(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

/** Clamps the daily window into the supported 1~180 day range. */
function clampDays(days: number): number {
  const numeric = Math.floor(Number(days) || 30);
  return Math.min(Math.max(numeric, 1), 180);
}

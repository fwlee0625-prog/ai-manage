import { Injectable, OnModuleInit } from '@nestjs/common';
import type { AiTool, PaginatedResult, ProjectSummary, ScanStatus, SessionSummary, SessionsQuery } from '@ai-manage/shared';
import { resolve } from 'node:path';
import { DATA_DIR } from '../utils.js';
import { INDEX_MIGRATIONS, migrationInsertStatement } from './index.migrations.js';
import {
  SESSION_SELECT_COLUMNS,
  buildSessionQuerySql,
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
        return `
          INSERT OR REPLACE INTO sessions (
            id, tool, title, project_path, created_at, updated_at, source_path, message_count, preview, search_text
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
            ${sqlString(searchText)}
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
      items: rows.map(row => ({ ...row, messageCount: Number(row.messageCount) })),
      total: countRows[0]?.total || 0,
      page: sessionQuery.page,
      pageSize: sessionQuery.pageSize,
    };
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
    return row ? { ...row, messageCount: Number(row.messageCount) } : undefined;
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

  private chunk<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      batches.push(items.slice(index, index + size));
    }
    return batches;
  }
}

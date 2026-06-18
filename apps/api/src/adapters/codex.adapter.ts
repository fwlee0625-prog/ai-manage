import { Injectable } from '@nestjs/common';
import type { ConfigFileDetail, ConfigFileSummary, DeleteSessionResponse, LogEntry, SessionDetail, SessionSummary } from '@ai-manage/shared';
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PathGuard } from '../fs/path-guard.js';
import { buildConfigSummary, readConfigDetail } from '../parsers/config-reader.js';
import { readJsonl } from '../parsers/jsonl.js';
import { normalizeText, stableId, toIsoFromMs } from '../utils.js';
import { SqliteDatabase, sqlString } from '../database/sqlite-database.js';
import type { AiToolAdapter } from './ai-tool.adapter.js';
import { messageFromRaw } from './ai-tool.adapter.js';
import { SessionDeleteBackup } from './session-delete.js';

@Injectable()
export class CodexAdapter implements AiToolAdapter {
  readonly tool = 'codex' as const;
  readonly rootPath: string;

  constructor(private readonly pathGuard: PathGuard) {
    this.rootPath = this.pathGuard.codexRoot;
  }

  isAvailable(): boolean {
    return this.pathGuard.existsDirectory(this.rootPath);
  }

  async listConfigFiles(): Promise<ConfigFileSummary[]> {
    const candidates = [
      { name: 'config.toml', category: 'config', editable: true, formKind: 'toml-config', hiddenFromConfigPage: false },
      { name: 'AGENTS.md', category: 'instruction', editable: true, formKind: 'markdown-instruction', hiddenFromConfigPage: false },
      { name: 'session_index.jsonl', category: 'index', editable: false, formKind: 'readonly', hiddenFromConfigPage: true },
      { name: 'history.jsonl', category: 'history', editable: false, formKind: 'readonly', hiddenFromConfigPage: true },
      { name: 'version.json', category: 'runtime', editable: false, formKind: 'readonly', hiddenFromConfigPage: true },
      { name: '.codex-global-state.json', category: 'runtime', editable: false, formKind: 'readonly', hiddenFromConfigPage: true },
    ] as const;
    const existing = candidates
      .map(candidate => ({ ...candidate, path: resolve(this.rootPath, candidate.name) }))
      .filter(candidate => existsSync(candidate.path));
    return Promise.all(existing.map(file => buildConfigSummary(this.tool, file.path, file)));
  }

  async getConfigFile(id: string): Promise<ConfigFileDetail | undefined> {
    const files = await this.listConfigFiles();
    const summary = files.find(file => file.id === id);
    if (!summary) return undefined;
    this.pathGuard.assertReadable(summary.path);
    return readConfigDetail(summary);
  }

  async scanSessions(): Promise<SessionSummary[]> {
    const fromDb = await this.scanThreadsDb();
    if (fromDb.length) return fromDb;
    return this.scanSessionIndex();
  }

  async readSession(summary: SessionSummary): Promise<SessionDetail> {
    const messages = await this.readMessagesForSummary(summary);
    return { ...summary, messages };
  }

  async deleteSession(summary: SessionSummary): Promise<DeleteSessionResponse> {
    const backup = new SessionDeleteBackup(this.tool, summary.id);
    const statePath = resolve(this.rootPath, 'state_5.sqlite');
    const indexPath = resolve(this.rootPath, 'session_index.jsonl');
    const historyPath = resolve(this.rootPath, 'history.jsonl');
    const fileCandidates = new Set<string>();

    if (
      summary.sourcePath.endsWith('.jsonl')
      && summary.sourcePath !== indexPath
      && summary.sourcePath !== historyPath
    ) {
      fileCandidates.add(summary.sourcePath);
    }
    for (const file of await this.findLikelySessionFiles(summary.id)) {
      fileCandidates.add(file);
    }

    if (existsSync(statePath)) this.pathGuard.assertWritableToolData(statePath);
    if (existsSync(indexPath)) this.pathGuard.assertWritableToolData(indexPath);
    if (existsSync(historyPath)) this.pathGuard.assertWritableToolData(historyPath);
    for (const file of fileCandidates) {
      this.pathGuard.assertWritableToolData(file);
    }

    await this.deleteThreadRow(summary.id, backup);

    if (existsSync(indexPath)) {
      await backup.rewriteJsonl(indexPath, row => normalizeText(row.id) === summary.id);
    }
    if (existsSync(historyPath)) {
      await backup.rewriteJsonl(historyPath, row => row.session_id === summary.id);
    }
    for (const file of fileCandidates) {
      await backup.removeFile(file);
    }

    return backup.finalize(summary);
  }

  async readLogs(limit = 100): Promise<LogEntry[]> {
    const logsPath = resolve(this.rootPath, 'logs_2.sqlite');
    if (!existsSync(logsPath)) return [];
    const rows = await new SqliteDatabase(logsPath).all<{
      id: number;
      ts: number;
      level: string;
      target?: string;
      thread_id?: string;
      feedback_log_body?: string;
      module_path?: string;
      file?: string;
      line?: number;
    }>(`
      SELECT id, ts, level, target, thread_id, feedback_log_body, module_path, file, line
      FROM logs
      ORDER BY id DESC
      LIMIT ${Math.min(Number(limit) || 100, 500)};
    `);
    return rows.map(row => ({
      id: String(row.id),
      tool: this.tool,
      timestamp: toIsoFromMs(row.ts),
      level: row.level,
      target: row.target,
      threadId: row.thread_id,
      message: row.feedback_log_body || [row.module_path, row.file, row.line].filter(Boolean).join(':') || '',
      raw: row,
    }));
  }

  private async scanThreadsDb(): Promise<SessionSummary[]> {
    const statePath = resolve(this.rootPath, 'state_5.sqlite');
    if (!existsSync(statePath)) return [];
    const threadNames = await this.readThreadNames();
    const rows = await new SqliteDatabase(statePath).all<{
      id: string;
      title: string;
      cwd: string;
      createdAt?: string;
      updatedAt?: string;
      source_path?: string;
      first_user_message?: string;
      preview?: string;
      tokens_used?: number;
    }>(`
      SELECT
        id,
        title,
        cwd,
        datetime(COALESCE(created_at_ms, created_at * 1000) / 1000, 'unixepoch') AS createdAt,
        datetime(COALESCE(updated_at_ms, updated_at * 1000) / 1000, 'unixepoch') AS updatedAt,
        rollout_path AS source_path,
        first_user_message,
        preview,
        tokens_used
      FROM threads
      ORDER BY COALESCE(updated_at_ms, updated_at * 1000) DESC
      LIMIT 5000;
    `);
    return Promise.all(rows.map(async row => {
      const sourcePath = row.source_path || statePath;
      const dbUpdatedAt = row.updatedAt ? new Date(`${row.updatedAt}Z`).toISOString() : undefined;
      return {
        id: row.id,
        tool: this.tool,
        title: threadNames.get(row.id) || row.title || row.first_user_message || row.id,
        projectPath: row.cwd || '',
        createdAt: row.createdAt ? new Date(`${row.createdAt}Z`).toISOString() : undefined,
        updatedAt: await this.latestSessionUpdatedAt(dbUpdatedAt, sourcePath),
        sourcePath,
        messageCount: 0,
        preview: row.preview || row.first_user_message || '',
      };
    }));
  }

  private async deleteThreadRow(sessionId: string, backup: SessionDeleteBackup): Promise<void> {
    const statePath = resolve(this.rootPath, 'state_5.sqlite');
    if (!existsSync(statePath)) return;
    this.pathGuard.assertWritableToolData(statePath);
    const sqlite = new SqliteDatabase(statePath);
    const rows = await sqlite.all<Record<string, unknown>>(`SELECT * FROM threads WHERE id = ${sqlString(sessionId)};`);
    if (!rows.length) return;
    await backup.writeJson('state_5.sqlite.threads.json', rows, statePath);
    await sqlite.exec(`DELETE FROM threads WHERE id = ${sqlString(sessionId)};`);
    backup.updatedPaths.push(statePath);
  }

  private async readThreadNames(): Promise<Map<string, string>> {
    const indexPath = resolve(this.rootPath, 'session_index.jsonl');
    if (!existsSync(indexPath)) return new Map();
    const rows = await readJsonl<Record<string, unknown>>(indexPath, 10000);
    const names = new Map<string, string>();
    for (const row of rows) {
      const id = normalizeText(row.id);
      const name = normalizeText(row.thread_name);
      if (id && name) names.set(id, name);
    }
    return names;
  }

  private async scanSessionIndex(): Promise<SessionSummary[]> {
    const indexPath = resolve(this.rootPath, 'session_index.jsonl');
    if (!existsSync(indexPath)) return [];
    const rows = await readJsonl<Record<string, unknown>>(indexPath, 5000);
    return rows.map(row => ({
      id: String(row.id || stableId(JSON.stringify(row))),
      tool: this.tool,
      title: normalizeText(row.thread_name || row.title || row.id),
      projectPath: '',
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
      sourcePath: indexPath,
      messageCount: 0,
      preview: normalizeText(row.thread_name || ''),
    }));
  }

  private async readMessagesForSummary(summary: SessionSummary) {
    if (summary.sourcePath.endsWith('.jsonl') && existsSync(summary.sourcePath)) {
      const rows = await readJsonl<Record<string, unknown>>(summary.sourcePath, 5000);
      return rows.map((row, index) => messageFromRaw(`${summary.id}:${index}`, row));
    }

    const candidates = await this.findLikelySessionFiles(summary.id);
    for (const candidate of candidates) {
      const rows = await readJsonl<Record<string, unknown>>(candidate, 2000);
      if (!rows.length) continue;
      return rows.map((row, index) => messageFromRaw(`${summary.id}:${index}`, row));
    }
    const historyPath = resolve(this.rootPath, 'history.jsonl');
    if (existsSync(historyPath)) {
      const rows = await readJsonl<Record<string, unknown>>(historyPath, 2000);
      return rows
        .filter(row => row.session_id === summary.id)
        .map((row, index) => messageFromRaw(`${summary.id}:history:${index}`, row, toIsoFromMs(row.ts as number)));
    }
    return [];
  }

  private async findLikelySessionFiles(sessionId: string): Promise<string[]> {
    const roots = [resolve(this.rootPath, 'sessions')];
    const files: string[] = [];
    for (const root of roots) {
      if (!existsSync(root)) continue;
      await this.walk(root, file => {
        if (file.includes(sessionId) && file.endsWith('.jsonl')) files.push(file);
      });
    }
    return files;
  }

  private async latestSessionUpdatedAt(dbUpdatedAt: string | undefined, sourcePath: string): Promise<string | undefined> {
    if (!sourcePath.endsWith('.jsonl') || !existsSync(sourcePath)) return dbUpdatedAt;
    const fileUpdatedAt = (await stat(sourcePath)).mtime.toISOString();
    if (!dbUpdatedAt) return fileUpdatedAt;
    return new Date(fileUpdatedAt).getTime() > new Date(dbUpdatedAt).getTime() ? fileUpdatedAt : dbUpdatedAt;
  }

  private async walk(dir: string, visit: (file: string) => void): Promise<void> {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const full = resolve(dir, entry);
      const meta = await stat(full);
      if (meta.isDirectory()) await this.walk(full, visit);
      else visit(full);
    }
  }
}

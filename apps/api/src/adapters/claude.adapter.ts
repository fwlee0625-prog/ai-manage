import { Injectable } from '@nestjs/common';
import type { ConfigFileDetail, ConfigFileSummary, DeleteSessionResponse, LogEntry, SessionDetail, SessionSummary } from '@ai-manage/shared';
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PathGuard } from '../fs/path-guard.js';
import { buildConfigSummary, readConfigDetail } from '../parsers/config-reader.js';
import { countJsonl, readJsonl } from '../parsers/jsonl.js';
import { normalizeText, stableId } from '../utils.js';
import type { AiToolAdapter } from './ai-tool.adapter.js';
import { messageFromRaw } from './ai-tool.adapter.js';
import { SessionDeleteBackup } from './session-delete.js';

@Injectable()
export class ClaudeAdapter implements AiToolAdapter {
  readonly tool = 'claude' as const;
  readonly rootPath: string;

  constructor(private readonly pathGuard: PathGuard) {
    this.rootPath = this.pathGuard.claudeRoot;
  }

  isAvailable(): boolean {
    return this.pathGuard.existsDirectory(this.rootPath);
  }

  async listConfigFiles(): Promise<ConfigFileSummary[]> {
    const candidates = [
      { name: 'settings.json', category: 'config', editable: true, formKind: 'json-config', hiddenFromConfigPage: false },
      { name: 'settings.local.json', category: 'config', editable: true, formKind: 'json-config', hiddenFromConfigPage: false },
      { name: 'CLAUDE.md', category: 'instruction', editable: true, formKind: 'markdown-instruction', hiddenFromConfigPage: false },
      { name: 'history.jsonl', category: 'history', editable: false, formKind: 'readonly', hiddenFromConfigPage: true },
      { name: 'stats-cache.json', category: 'cache', editable: false, formKind: 'readonly', hiddenFromConfigPage: true },
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
    const projectsRoot = resolve(this.rootPath, 'projects');
    if (!existsSync(projectsRoot)) return this.scanHistoryOnly();
    const files: string[] = [];
    await this.walk(projectsRoot, file => {
      if (file.endsWith('.jsonl')) files.push(file);
    });

    const sessions = await Promise.all(files.slice(0, 5000).map(file => this.summaryFromProjectFile(file)));
    return sessions.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  async readSession(summary: SessionSummary): Promise<SessionDetail> {
    const rows = existsSync(summary.sourcePath)
      ? await readJsonl<Record<string, unknown>>(summary.sourcePath, 5000)
      : [];
    return {
      ...summary,
      messages: rows.map((row, index) => messageFromRaw(`${summary.id}:${index}`, row)),
    };
  }

  async deleteSession(summary: SessionSummary): Promise<DeleteSessionResponse> {
    const backup = new SessionDeleteBackup(this.tool, summary.id);
    const historyPath = resolve(this.rootPath, 'history.jsonl');
    const sessionIds = await this.sessionIdsFromSource(summary.sourcePath);
    sessionIds.add(summary.id);

    if (summary.sourcePath === historyPath) {
      this.pathGuard.assertWritableToolData(historyPath);
      await backup.rewriteJsonl(historyPath, (row, index) => {
        const rowSessionId = normalizeText(row.sessionId);
        return sessionIds.has(rowSessionId) || stableId(`${historyPath}:${index}`) === summary.id;
      });
    } else if (summary.sourcePath.endsWith('.jsonl')) {
      this.pathGuard.assertWritableToolData(summary.sourcePath);
      await backup.removeFile(summary.sourcePath);
    }

    if (existsSync(historyPath) && summary.sourcePath !== historyPath) {
      this.pathGuard.assertWritableToolData(historyPath);
      await backup.rewriteJsonl(historyPath, row => sessionIds.has(normalizeText(row.sessionId)));
    }

    return backup.finalize(summary);
  }

  async readLogs(): Promise<LogEntry[]> {
    return [];
  }

  private async summaryFromProjectFile(file: string): Promise<SessionSummary> {
    const rows = await readJsonl<Record<string, unknown>>(file, 80);
    const firstMessage = rows.find(row => row.type === 'user' || row.message);
    const last = rows.at(-1);
    const sessionId = normalizeText(firstMessage?.sessionId || last?.sessionId || file.split('/').at(-1)?.replace(/\.jsonl$/, ''));
    const projectPath = normalizeText(firstMessage?.cwd || this.projectPathFromFile(file));
    const preview = this.previewFromRows(rows);
    const meta = await stat(file);
    const messageCount = await countJsonl(file);
    return {
      id: stableId(file),
      tool: this.tool,
      title: preview || sessionId || file.split('/').at(-1) || file,
      projectPath,
      createdAt: typeof firstMessage?.timestamp === 'string' ? firstMessage.timestamp : meta.birthtime.toISOString(),
      updatedAt: typeof last?.timestamp === 'string' ? last.timestamp : meta.mtime.toISOString(),
      sourcePath: file,
      messageCount,
      preview,
    };
  }

  private async scanHistoryOnly(): Promise<SessionSummary[]> {
    const historyPath = resolve(this.rootPath, 'history.jsonl');
    if (!existsSync(historyPath)) return [];
    const rows = await readJsonl<Record<string, unknown>>(historyPath, 5000);
    return rows.map((row, index) => ({
      id: normalizeText(row.sessionId || stableId(`${historyPath}:${index}`)),
      tool: this.tool,
      title: normalizeText(row.display || row.sessionId || 'Claude session'),
      projectPath: normalizeText(row.project),
      updatedAt: typeof row.timestamp === 'number' ? new Date(row.timestamp).toISOString() : undefined,
      sourcePath: historyPath,
      messageCount: 1,
      preview: normalizeText(row.display),
    }));
  }

  private previewFromRows(rows: Record<string, unknown>[]): string {
    const userRow = rows.find(row => {
      const message = row.message as Record<string, unknown> | undefined;
      return row.type === 'user' || message?.role === 'user';
    });
    const message = userRow?.message as Record<string, unknown> | undefined;
    return normalizeText(message?.content || userRow?.content || userRow?.display || '').slice(0, 240);
  }

  private async sessionIdsFromSource(file: string): Promise<Set<string>> {
    const ids = new Set<string>();
    if (!existsSync(file) || !file.endsWith('.jsonl')) return ids;
    const rows = await readJsonl<Record<string, unknown>>(file, 5000);
    for (const row of rows) {
      const sessionId = normalizeText(row.sessionId);
      if (sessionId) ids.add(sessionId);
    }
    return ids;
  }

  private projectPathFromFile(file: string): string {
    const projectsRoot = resolve(this.rootPath, 'projects');
    const rel = file.replace(projectsRoot, '').split('/').filter(Boolean)[0] || '';
    return rel ? `/${rel.replaceAll('-', '/')}` : '';
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

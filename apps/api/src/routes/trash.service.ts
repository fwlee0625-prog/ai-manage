import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AiTool, ClearTrashSessionsResponse, RestoreTrashSessionResponse, TrashSessionDetail, TrashSessionFilePreview, TrashSessionManifest, TrashSessionSummary } from '@ai-manage/shared';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { SqliteDatabase, sqlString } from '../database/sqlite-database.js';
import { PathGuard } from '../fs/path-guard.js';
import { IndexingService } from '../indexing/indexing.service.js';
import { DATA_DIR } from '../utils.js';

const TRASH_ROOT = resolve(DATA_DIR, 'deleted-sessions');
const MAX_PREVIEW_BYTES = 1024 * 1024;

@Injectable()
export class TrashService {
  constructor(
    private readonly indexing: IndexingService,
    private readonly pathGuard: PathGuard,
  ) {}

  async sessions(tool?: AiTool): Promise<TrashSessionSummary[]> {
    const manifests = await this.readAllManifests(tool);
    return manifests
      .map(manifest => this.toSummary(manifest))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  async session(trashId: string): Promise<TrashSessionDetail> {
    const manifest = await this.findManifest(trashId);
    return {
      ...this.toSummary(manifest),
      files: manifest.files,
    };
  }

  async filePreview(trashId: string, index: number): Promise<TrashSessionFilePreview> {
    const manifest = await this.findManifest(trashId);
    const file = manifest.files[index];
    if (!file) throw new NotFoundException('Trash file not found');
    this.assertInsideTrash(file.backupPath);
    const meta = await stat(file.backupPath);
    const base = {
      trashId,
      index,
      name: file.name,
      backupPath: file.backupPath,
      size: meta.size,
    };
    if (meta.size > MAX_PREVIEW_BYTES) {
      return { ...base, previewType: 'unsupported', supported: false, reason: '文件过大，暂不支持预览' };
    }

    const extension = extname(file.name).toLowerCase();
    if (!this.isTextExtension(extension)) {
      return { ...base, previewType: 'unsupported', supported: false, reason: '暂不支持该文件类型预览' };
    }
    const raw = await readFile(file.backupPath, 'utf8');
    return {
      ...base,
      previewType: extension === '.json' ? 'json' : 'text',
      content: extension === '.json' ? this.formatJson(raw) : raw,
      supported: true,
    };
  }

  async restoreSession(trashId: string): Promise<RestoreTrashSessionResponse> {
    const manifest = await this.findManifest(trashId);
    const restoredPaths: string[] = [];
    const updatedPaths: string[] = [];
    if (!manifest.files.length || manifest.files.some(file => !file.originalPath)) {
      throw new BadRequestException('旧备份缺少原始路径，无法自动恢复');
    }

    for (const file of manifest.files) {
      this.assertInsideTrash(file.backupPath);
      if (file.originalPath) this.pathGuard.assertWritableToolData(file.originalPath);
      if (file.operation === 'removed-file' && file.originalPath && existsSync(file.originalPath)) {
        throw new ConflictException(`Restore target already exists: ${file.originalPath}`);
      }
    }

    for (const file of manifest.files) {
      if (file.operation !== 'removed-file' || !file.originalPath) continue;
      await mkdir(dirname(file.originalPath), { recursive: true });
      await copyFile(file.backupPath, file.originalPath);
      restoredPaths.push(file.originalPath);
    }

    for (const file of manifest.files) {
      if (file.operation !== 'updated-jsonl' || !file.originalPath) continue;
      this.assertInsideTrash(file.backupPath);
      this.pathGuard.assertWritableToolData(file.originalPath);
      const changed = await this.restoreJsonlRows(file.originalPath, file.backupPath, file.removedLines || []);
      if (changed === 'created') restoredPaths.push(file.originalPath);
      if (changed === 'updated') updatedPaths.push(file.originalPath);
    }

    for (const file of manifest.files) {
      if (file.operation !== 'metadata' || file.name !== 'state_5.sqlite.threads.json' || !file.originalPath) continue;
      this.assertInsideTrash(file.backupPath);
      this.pathGuard.assertWritableToolData(file.originalPath);
      const restored = await this.restoreSqliteRows(file.originalPath, file.backupPath, 'threads');
      if (restored) updatedPaths.push(file.originalPath);
    }

    await this.indexing.refreshTool(manifest.tool);
    await this.deleteSession(trashId);

    return {
      trashId,
      id: manifest.id,
      tool: manifest.tool,
      restoredPaths,
      updatedPaths,
    };
  }

  async deleteSession(trashId: string): Promise<void> {
    const manifest = await this.findManifest(trashId);
    this.assertInsideTrash(manifest.backupDir);
    await rm(manifest.backupDir, { recursive: true, force: true });
  }

  async clearSessions(tool?: AiTool): Promise<ClearTrashSessionsResponse> {
    const manifests = await this.readAllManifests(tool);
    for (const manifest of manifests) {
      this.assertInsideTrash(manifest.backupDir);
      await rm(manifest.backupDir, { recursive: true, force: true });
    }
    return { deletedCount: manifests.length };
  }

  private async readAllManifests(tool?: AiTool): Promise<TrashSessionManifest[]> {
    const tools: AiTool[] = tool ? [tool] : ['codex', 'claude'];
    const manifests: TrashSessionManifest[] = [];
    for (const item of tools) {
      const toolRoot = resolve(TRASH_ROOT, item);
      if (!existsSync(toolRoot)) continue;
      const entries = await readdir(toolRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = resolve(toolRoot, entry.name);
        const manifest = await this.readManifest(resolve(dirPath, 'manifest.json'))
          || await this.readLegacyManifest(item, entry.name, dirPath);
        if (manifest) manifests.push(manifest);
      }
    }
    return manifests;
  }

  private async findManifest(trashId: string): Promise<TrashSessionManifest> {
    const manifests = await this.readAllManifests();
    const manifest = manifests.find(item => item.trashId === trashId);
    if (!manifest) throw new NotFoundException('Trash session not found');
    return manifest;
  }

  private async readManifest(path: string): Promise<TrashSessionManifest | undefined> {
    if (!existsSync(path)) return undefined;
    this.assertInsideTrash(path);
    try {
      const manifest = JSON.parse(await readFile(path, 'utf8')) as TrashSessionManifest;
      this.assertInsideTrash(manifest.backupDir);
      return manifest;
    } catch {
      return undefined;
    }
  }

  private async readLegacyManifest(tool: AiTool, trashId: string, backupDir: string): Promise<TrashSessionManifest | undefined> {
    this.assertInsideTrash(backupDir);
    const entries = await readdir(backupDir, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile() && entry.name !== 'manifest.json')
      .map(entry => {
        const backupPath = resolve(backupDir, entry.name);
        return {
          name: entry.name,
          operation: this.legacyOperationFromFileName(entry.name),
          backupPath,
        };
      });
    if (!files.length) return undefined;
    const { deletedAt, id } = this.parseLegacyTrashId(trashId);
    return {
      trashId,
      id,
      tool,
      title: `旧备份 ${id}`,
      projectPath: '',
      sourcePath: '',
      deletedAt,
      backupDir,
      removedPaths: [],
      updatedPaths: [],
      files,
    };
  }

  private toSummary(manifest: TrashSessionManifest): TrashSessionSummary {
    return {
      trashId: manifest.trashId,
      id: manifest.id,
      tool: manifest.tool,
      title: manifest.title,
      projectPath: manifest.projectPath,
      sourcePath: manifest.sourcePath,
      deletedAt: manifest.deletedAt,
      backupDir: manifest.backupDir,
      removedPaths: manifest.removedPaths,
      updatedPaths: manifest.updatedPaths,
      fileCount: manifest.files.length,
      restorable: manifest.files.length > 0 && manifest.files.every(file => !!file.originalPath),
    };
  }

  private async restoreJsonlRows(
    originalPath: string,
    backupPath: string,
    removedLines: string[],
  ): Promise<'created' | 'updated' | 'unchanged'> {
    if (!existsSync(originalPath)) {
      await mkdir(dirname(originalPath), { recursive: true });
      await copyFile(backupPath, originalPath);
      return 'created';
    }
    if (!removedLines.length) return 'unchanged';
    const raw = await readFile(originalPath, 'utf8');
    const existing = new Set(raw.split(/\r?\n/).filter(Boolean));
    const missing = removedLines.filter(line => !existing.has(line));
    if (!missing.length) return 'unchanged';
    const prefix = raw ? (raw.endsWith('\n') ? raw : `${raw}\n`) : '';
    await writeFile(originalPath, `${prefix}${missing.join('\n')}\n`, 'utf8');
    return 'updated';
  }

  private async restoreSqliteRows(dbPath: string, backupPath: string, table: string): Promise<boolean> {
    const raw = await readFile(backupPath, 'utf8');
    const rows = JSON.parse(raw) as Record<string, unknown>[];
    if (!Array.isArray(rows) || !rows.length) return false;
    const statements = rows.map(row => {
      const keys = Object.keys(row).filter(key => row[key] !== undefined);
      const columns = keys.map(sqlIdentifier).join(', ');
      const values = keys.map(key => sqlValue(row[key])).join(', ');
      return `INSERT OR REPLACE INTO ${sqlIdentifier(table)} (${columns}) VALUES (${values});`;
    });
    await new SqliteDatabase(dbPath).transaction(statements);
    return true;
  }

  private isTextExtension(extension: string): boolean {
    return ['.json', '.jsonl', '.txt', '.md', '.log', '.toml'].includes(extension);
  }

  private formatJson(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  private legacyOperationFromFileName(name: string): 'removed-file' | 'updated-jsonl' | 'metadata' {
    if (name.endsWith('.json')) return 'metadata';
    if (name.includes('session_index') || name.includes('history')) return 'updated-jsonl';
    return 'removed-file';
  }

  private parseLegacyTrashId(trashId: string): { deletedAt: string; id: string } {
    const match = trashId.match(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3}Z)-(.+)$/);
    if (!match) {
      return { deletedAt: new Date(0).toISOString(), id: trashId };
    }
    return {
      deletedAt: `${match[1]}:${match[2]}:${match[3]}.${match[4]}`,
      id: match[5],
    };
  }

  private assertInsideTrash(path: string): void {
    const rel = relative(TRASH_ROOT, resolve(path));
    if (rel.startsWith('..') || rel.startsWith('/')) {
      throw new BadRequestException('Path is outside trash root');
    }
  }
}

function sqlIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return sqlString(value);
}

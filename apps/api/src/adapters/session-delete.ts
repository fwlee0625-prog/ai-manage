import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { AiTool, DeleteSessionResponse, SessionSummary, TrashSessionFile, TrashSessionManifest } from '@ai-manage/shared';
import { DATA_DIR } from '../utils.js';

export class SessionDeleteBackup {
  readonly trashId: string;
  readonly backupDir: string;
  readonly removedPaths: string[] = [];
  readonly updatedPaths: string[] = [];
  readonly files: TrashSessionFile[] = [];
  readonly deletedAt = new Date().toISOString();
  private fileCounter = 0;

  constructor(readonly tool: AiTool, readonly id: string) {
    const stamp = this.deletedAt.replace(/[:.]/g, '-');
    this.trashId = `${stamp}-${safeName(id)}`;
    this.backupDir = resolve(DATA_DIR, 'deleted-sessions', tool, this.trashId);
  }

  async removeFile(filePath: string): Promise<void> {
    if (!existsSync(filePath)) return;
    await this.backupFile(filePath, 'removed-file');
    await unlink(filePath);
    this.removedPaths.push(filePath);
  }

  async rewriteJsonl(
    filePath: string,
    shouldRemove: (row: Record<string, unknown>, index: number) => boolean,
  ): Promise<number> {
    if (!existsSync(filePath)) return 0;
    const raw = await readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const kept: string[] = [];
    const removedLines: string[] = [];
    let removed = 0;
    let rowIndex = 0;

    for (const line of lines) {
      if (!line.trim()) {
        if (line || kept.length) kept.push(line);
        continue;
      }
      try {
        const row = JSON.parse(line) as Record<string, unknown>;
        if (shouldRemove(row, rowIndex)) {
          removed += 1;
          removedLines.push(line);
        } else {
          kept.push(line);
        }
        rowIndex += 1;
      } catch {
        kept.push(line);
      }
    }

    if (!removed) return 0;
    await this.backupFile(filePath, 'updated-jsonl', { removedLines });
    const nextRaw = kept.filter((line, index) => line || index < kept.length - 1).join('\n');
    const tempPath = `${filePath}.ai-manage.tmp`;
    await writeFile(tempPath, nextRaw ? `${nextRaw}\n` : '', 'utf8');
    await rename(tempPath, filePath);
    this.updatedPaths.push(filePath);
    return removed;
  }

  async writeJson(name: string, value: unknown, originalPath?: string): Promise<void> {
    await mkdir(this.backupDir, { recursive: true });
    const backupPath = resolve(this.backupDir, safeName(name));
    await writeFile(backupPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    this.files.push({
      name,
      operation: 'metadata',
      backupPath,
      originalPath,
    });
  }

  async finalize(summary: SessionSummary): Promise<DeleteSessionResponse> {
    const manifest: TrashSessionManifest = {
      trashId: this.trashId,
      id: summary.id,
      tool: summary.tool,
      title: summary.title,
      projectPath: summary.projectPath,
      sourcePath: summary.sourcePath,
      deletedAt: this.deletedAt,
      backupDir: this.backupDir,
      removedPaths: this.removedPaths,
      updatedPaths: this.updatedPaths,
      files: this.files,
    };
    await mkdir(this.backupDir, { recursive: true });
    await writeFile(resolve(this.backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return this.response(summary.tool, summary.id);
  }

  response(tool: AiTool, id: string): DeleteSessionResponse {
    return {
      tool,
      id,
      trashId: this.trashId,
      removedPaths: this.removedPaths,
      updatedPaths: this.updatedPaths,
      backupDir: this.backupDir,
    };
  }

  private async backupFile(
    filePath: string,
    operation: TrashSessionFile['operation'],
    extra: Pick<TrashSessionFile, 'removedLines'> = {},
  ): Promise<void> {
    await mkdir(this.backupDir, { recursive: true });
    this.fileCounter += 1;
    const target = resolve(this.backupDir, `${String(this.fileCounter).padStart(3, '0')}-${safeName(basename(filePath))}`);
    await copyFile(filePath, target);
    this.files.push({
      name: basename(filePath),
      operation,
      backupPath: target,
      originalPath: filePath,
      ...extra,
    });
  }
}

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'session';
}

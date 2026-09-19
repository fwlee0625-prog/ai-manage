import { Injectable } from '@nestjs/common';
import type { AiTool } from '@ai-manage/shared';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PathGuard } from '../fs/path-guard.js';
import { parseTomlLoose, serializeTomlLoose } from '../parsers/toml.js';
import type { ProjectionResult } from '../projections/projection.types.js';

export interface RuntimeLiveState {
  config: Record<string, unknown>;
  auth?: Record<string, unknown>;
}
export interface RuntimeRawFile {
  path: string;
  existed: boolean;
  raw?: string;
}
export interface RuntimeRawSnapshot {
  tool: AiTool;
  files: RuntimeRawFile[];
}

@Injectable()
export class LiveFileWriterService {
  constructor(private readonly pathGuard: PathGuard) {}

  /** Reads the current live files into structured projection input. */
  async readLive(tool: AiTool): Promise<RuntimeLiveState> {
    if (tool === 'codex') {
      const configPath = resolve(this.pathGuard.codexRoot, 'config.toml');
      const raw = existsSync(configPath) ? await readFile(configPath, 'utf8') : '';
      const authPath = this.pathGuard.codexAuthPath;
      return {
        config: raw ? parseTomlLoose(raw) : {},
        auth: existsSync(authPath) ? this.parseJson(await readFile(authPath, 'utf8'), 'auth.json') : {},
      };
    }
    const settingsPath = resolve(this.pathGuard.claudeRoot, 'settings.json');
    const raw = existsSync(settingsPath) ? await readFile(settingsPath, 'utf8') : '{}';
    return { config: this.parseJson(raw, 'settings.json') };
  }

  /** Atomically replaces projected live files one file at a time. Cross-file rollback is handled by SnapshotService. */
  async writeProjection(tool: AiTool, projection: ProjectionResult): Promise<void> {
    if (tool === 'codex') {
      const configPath = this.pathGuard.assertWritableConfig(resolve(this.pathGuard.codexRoot, 'config.toml'));
      await this.atomicWrite(configPath, serializeTomlLoose(projection.config), 'toml');
      if (projection.authTouched && projection.auth) {
        const authPath = this.pathGuard.assertWritableCodexAuth();
        await this.atomicWrite(authPath, `${JSON.stringify(projection.auth, null, 2)}\n`, 'json');
      }
      return;
    }
    const settingsPath = this.pathGuard.assertWritableConfig(resolve(this.pathGuard.claudeRoot, 'settings.json'));
    await this.atomicWrite(settingsPath, `${JSON.stringify(projection.config, null, 2)}\n`, 'json');
  }

  /** Captures exact file existence and content for tool-level rollback. */
  async capture(tool: AiTool): Promise<RuntimeRawSnapshot> {
    const paths = tool === 'codex'
      ? [resolve(this.pathGuard.codexRoot, 'config.toml'), this.pathGuard.codexAuthPath]
      : [resolve(this.pathGuard.claudeRoot, 'settings.json')];
    const files: RuntimeRawFile[] = [];
    for (const path of paths) {
      const existed = existsSync(path);
      files.push({ path, existed, raw: existed ? await readFile(path, 'utf8') : undefined });
    }
    return { tool, files };
  }

  /** Restores exact file existence and contents from a snapshot. */
  async restore(snapshot: RuntimeRawSnapshot): Promise<void> {
    for (const file of snapshot.files) {
      this.assertSnapshotPath(snapshot.tool, file.path);
      if (!file.existed) {
        if (existsSync(file.path)) await unlink(file.path);
        continue;
      }
      await mkdir(dirname(file.path), { recursive: true });
      await this.atomicWrite(file.path, file.raw || '', file.path.endsWith('.toml') ? 'toml' : 'json');
    }
  }

  private async atomicWrite(path: string, raw: string, kind: 'json' | 'toml'): Promise<void> {
    if (kind === 'json') this.parseJson(raw, path);
    else parseTomlLoose(raw);
    await mkdir(dirname(path), { recursive: true });
    const tempPath = `${path}.ai-manage.tmp`;
    await writeFile(tempPath, raw, 'utf8');
    await rename(tempPath, path);
  }

  private parseJson(raw: string, label: string): Record<string, unknown> {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must contain a JSON object`);
    return value as Record<string, unknown>;
  }

  private assertSnapshotPath(tool: AiTool, path: string): void {
    if (tool === 'codex' && path === this.pathGuard.codexAuthPath) { this.pathGuard.assertWritableCodexAuth(path); return; }
    this.pathGuard.assertWritableConfig(path);
  }
}

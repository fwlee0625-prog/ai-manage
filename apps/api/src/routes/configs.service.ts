import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AiTool,
  CodexOpenAiApiKeyResponse,
  ConfigFileDetail,
  ConfigFileSummary,
  ReplaceCodexOpenAiApiKeyRequest,
  ReplaceCodexOpenAiApiKeyResponse,
  SaveConfigFileRequest,
  SaveConfigFileResponse,
} from '@ai-manage/shared';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AdapterRegistry } from '../adapters/adapter-registry.js';
import { PathGuard } from '../fs/path-guard.js';
import { hashConfigRaw, readConfigDetail, serializeConfigRequest } from '../parsers/config-reader.js';
import { DATA_DIR } from '../utils.js';

@Injectable()
export class ConfigsService {
  constructor(
    private readonly adapters: AdapterRegistry,
    private readonly pathGuard: PathGuard,
  ) {}

  /** Lists visible config files for one tool or all tools. */
  async configFiles(tool?: AiTool): Promise<ConfigFileSummary[]> {
    const adapters = tool ? [this.requireAdapter(tool)] : this.adapters.all();
    const nested = await Promise.all(adapters.map(adapter => adapter.listConfigFiles()));
    return nested.flat().filter(file => !file.hiddenFromConfigPage);
  }

  /** Reads one config detail by stable id. */
  async configFile(id: string): Promise<ConfigFileDetail> {
    for (const adapter of this.adapters.all()) {
      const detail = await adapter.getConfigFile(id);
      if (detail) return detail;
    }
    throw new NotFoundException('Config file not found');
  }

  /** Saves an editable config file with optimistic hash conflict checks. */
  async saveConfigFile(id: string, body: SaveConfigFileRequest): Promise<SaveConfigFileResponse> {
    const summary = await this.findConfigSummary(id);
    if (!summary.editable || summary.hiddenFromConfigPage) {
      throw new BadRequestException('Config file is not editable');
    }
    this.pathGuard.assertWritableConfig(summary.path);

    const currentRaw = await readFile(summary.path, 'utf8');
    const currentHash = hashConfigRaw(currentRaw);
    if (body.expectedHash !== currentHash) {
      throw new ConflictException('Config file changed on disk; refresh before saving');
    }

    let nextRaw: string;
    try {
      nextRaw = serializeConfigRequest(summary, body);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }

    const backupPath = await this.backupConfigFile(summary);
    const tempPath = `${summary.path}.ai-manage.tmp`;
    await writeFile(tempPath, nextRaw, 'utf8');
    await rename(tempPath, summary.path);

    return {
      detail: await readConfigDetail(await this.findConfigSummary(id)),
      backupPath,
    };
  }

  /** Reads the Codex OPENAI_API_KEY from auth.json. */
  async codexOpenAiApiKey(): Promise<CodexOpenAiApiKeyResponse> {
    const authPath = this.pathGuard.assertCodexAuth();
    if (!existsSync(authPath)) return { openaiApiKey: '', exists: false };

    const current = await this.readCodexAuth(authPath);
    const openaiApiKey = current.OPENAI_API_KEY;
    return {
      openaiApiKey: typeof openaiApiKey === 'string' ? openaiApiKey : '',
      exists: Object.prototype.hasOwnProperty.call(current, 'OPENAI_API_KEY'),
    };
  }

  /** Replaces the Codex OPENAI_API_KEY while preserving other auth.json fields. */
  async replaceCodexOpenAiApiKey(
    body: ReplaceCodexOpenAiApiKeyRequest,
  ): Promise<ReplaceCodexOpenAiApiKeyResponse> {
    const openaiApiKey = body.openaiApiKey?.trim();
    if (!openaiApiKey) throw new BadRequestException('openaiApiKey is required');

    const authPath = this.pathGuard.assertWritableCodexAuth();
    let current: Record<string, unknown> = {};
    let backupPath: string | undefined;

    if (existsSync(authPath)) {
      current = await this.readCodexAuth(authPath);
      backupPath = await this.backupFile('codex', 'auth.json', authPath);
    }

    const next = {
      ...current,
      OPENAI_API_KEY: openaiApiKey,
    };
    const tempPath = `${authPath}.ai-manage.tmp`;
    await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(tempPath, authPath);

    return { backupPath };
  }

  private async readCodexAuth(authPath: string): Promise<Record<string, unknown>> {
    const raw = await readFile(authPath, 'utf8');
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('auth.json must contain a JSON object');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
  }

  private requireAdapter(tool: AiTool) {
    const adapter = this.adapters.get(tool);
    if (!adapter) throw new NotFoundException(`Unsupported tool: ${tool}`);
    return adapter;
  }

  private async findConfigSummary(id: string): Promise<ConfigFileSummary> {
    for (const adapter of this.adapters.all()) {
      const files = await adapter.listConfigFiles();
      const summary = files.find(file => file.id === id);
      if (summary) return summary;
    }
    throw new NotFoundException('Config file not found');
  }

  private async backupConfigFile(summary: ConfigFileSummary): Promise<string> {
    return this.backupFile(summary.tool, summary.name, summary.path);
  }

  private async backupFile(tool: AiTool, name: string, filePath: string): Promise<string> {
    const backupDir = resolve(DATA_DIR, 'backups', tool);
    await mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = name.replace(/[^A-Za-z0-9._-]/g, '_');
    const backupPath = resolve(backupDir, `${stamp}-${safeName}`);
    await copyFile(filePath, backupPath);
    return backupPath;
  }
}

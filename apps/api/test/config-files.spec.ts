import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ConfigFileSummary } from '@ai-manage/shared';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AiToolAdapter } from '../src/adapters/ai-tool.adapter.js';
import { ConfigsService } from '../src/routes/configs.service.js';
import { hashConfigRaw, readConfigDetail } from '../src/parsers/config-reader.js';
import { PathGuard } from '../src/fs/path-guard.js';

class TestPathGuard extends PathGuard {
  constructor(private readonly writableAuthPath?: string) {
    super();
  }

  override assertWritableConfig(filePath: string): string {
    return filePath;
  }

  override assertCodexAuth(filePath = this.writableAuthPath || this.codexAuthPath): string {
    return filePath;
  }

  override assertWritableCodexAuth(filePath = this.writableAuthPath || this.codexAuthPath): string {
    return filePath;
  }
}

describe('config file management', () => {
  it('filters hidden runtime and history files from config listing', async () => {
    const service = serviceWithSummaries([
      summary({ name: 'config.toml', hiddenFromConfigPage: false }),
      summary({ name: 'history.jsonl', hiddenFromConfigPage: true, editable: false }),
      summary({ name: 'stats-cache.json', hiddenFromConfigPage: true, editable: false }),
    ]);

    const files = await service.configFiles('codex');

    expect(files.map(file => file.name)).toEqual(['config.toml']);
  });

  it('saves editable config files with hash checks and backup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-manage-config-'));
    const filePath = join(dir, 'settings.json');
    const original = '{ "env": { "A": "1" } }\n';
    await writeFile(filePath, original);
    const file = summary({
      name: 'settings.json',
      path: filePath,
      tool: 'claude',
      format: 'json',
      formKind: 'json-config',
      hiddenFromConfigPage: false,
      editable: true,
    });
    const service = serviceWithSummaries([file]);

    const response = await service.saveConfigFile(file.id, {
      expectedHash: hashConfigRaw(original),
      mode: 'parsed',
      parsed: { env: { A: '2' } },
    });

    expect(existsSync(response.backupPath)).toBe(true);
    expect(await readFile(response.backupPath, 'utf8')).toBe(original);
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ env: { A: '2' } });
    await expect(service.saveConfigFile(file.id, {
      expectedHash: hashConfigRaw(original),
      mode: 'parsed',
      parsed: { env: { A: '3' } },
    })).rejects.toThrow(ConflictException);
  });

  it('rejects hidden or readonly files before saving', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-manage-config-'));
    const filePath = join(dir, 'history.jsonl');
    await writeFile(filePath, '{}\n');
    const file = summary({
      name: 'history.jsonl',
      path: filePath,
      format: 'jsonl',
      editable: false,
      hiddenFromConfigPage: true,
    });
    const service = serviceWithSummaries([file]);

    await expect(service.saveConfigFile(file.id, {
      expectedHash: hashConfigRaw('{}\n'),
      mode: 'raw',
      raw: '{}\n',
    })).rejects.toThrow(BadRequestException);
  });

  it('replaces OPENAI_API_KEY in Codex auth.json with backup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-manage-auth-'));
    const authPath = join(dir, 'auth.json');
    const original = '{ "OPENAI_API_KEY": "old", "account_id": "acct" }\n';
    await writeFile(authPath, original);
    const service = serviceWithSummaries([], new TestPathGuard(authPath));

    const response = await service.replaceCodexOpenAiApiKey({ openaiApiKey: 'new-key' });

    expect(response.backupPath).toBeTruthy();
    expect(existsSync(response.backupPath!)).toBe(true);
    expect(await readFile(response.backupPath!, 'utf8')).toBe(original);
    expect(JSON.parse(await readFile(authPath, 'utf8'))).toEqual({
      OPENAI_API_KEY: 'new-key',
      account_id: 'acct',
    });
  });

  it('reads OPENAI_API_KEY from Codex auth.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-manage-auth-'));
    const authPath = join(dir, 'auth.json');
    await writeFile(authPath, '{ "OPENAI_API_KEY": "existing-key", "account_id": "acct" }\n');
    const service = serviceWithSummaries([], new TestPathGuard(authPath));

    await expect(service.codexOpenAiApiKey()).resolves.toEqual({
      openaiApiKey: 'existing-key',
      exists: true,
    });
  });

  it('returns an empty OPENAI_API_KEY response when Codex auth.json is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-manage-auth-'));
    const service = serviceWithSummaries([], new TestPathGuard(join(dir, 'auth.json')));

    await expect(service.codexOpenAiApiKey()).resolves.toEqual({
      openaiApiKey: '',
      exists: false,
    });
  });
});

function serviceWithSummaries(files: ConfigFileSummary[], pathGuard = new TestPathGuard()) {
  const adapter: AiToolAdapter = {
    tool: 'codex',
    rootPath: tmpdir(),
    isAvailable: () => true,
    listConfigFiles: async () => files,
    getConfigFile: async (id: string) => {
      const file = files.find(item => item.id === id);
      return file ? readConfigDetail(file) : undefined;
    },
    scanSessions: async () => [],
    readSession: async () => {
      throw new Error('not needed');
    },
    readLogs: async () => [],
  };
  const adapters = {
    all: () => [adapter],
    get: () => adapter,
  };
  return new ConfigsService(adapters as never, pathGuard);
}

function summary(overrides: Partial<ConfigFileSummary>): ConfigFileSummary {
  const name = overrides.name || 'config.toml';
  return {
    id: `${overrides.tool || 'codex'}:${name}`,
    tool: overrides.tool || 'codex',
    name,
    path: overrides.path || join(tmpdir(), name),
    format: overrides.format || 'toml',
    size: 0,
    category: overrides.category || 'config',
    editable: overrides.editable ?? true,
    formKind: overrides.formKind || 'toml-config',
    hiddenFromConfigPage: overrides.hiddenFromConfigPage ?? false,
    ...overrides,
  };
}

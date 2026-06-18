import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { ConfigFileSummary } from '@ai-manage/shared';
import type { AiToolAdapter } from '../src/adapters/ai-tool.adapter.js';
import { IndexRepository } from '../src/database/index.repository.js';
import { IndexingService } from '../src/indexing/indexing.service.js';

describe('IndexingService', () => {
  it('reads persisted status without scanning adapters', async () => {
    const repository = await createRepository();
    let scanCount = 0;
    const adapter = fakeAdapter(() => {
      scanCount += 1;
    });
    const service = new IndexingService(adapterRegistry(adapter), repository);

    const status = await service.statuses();

    expect(status.statuses).toEqual([]);
    expect(scanCount).toBe(0);
  });

  it('scans adapters only when refresh is requested', async () => {
    const repository = await createRepository();
    let scanCount = 0;
    const adapter = fakeAdapter(() => {
      scanCount += 1;
    });
    const service = new IndexingService(adapterRegistry(adapter), repository);

    const [status] = await service.refreshAll();

    expect(scanCount).toBe(1);
    expect(status.tool).toBe('codex');
    expect(status.sessionCount).toBe(1);
    expect((await service.statuses()).statuses[0].sessionCount).toBe(1);
  });
});

async function createRepository() {
  const dir = await mkdtemp(resolve(tmpdir(), 'ai-manage-indexing-'));
  const repository = IndexRepository.forDatabase(resolve(dir, 'index.sqlite'));
  await repository.init();
  return repository;
}

function adapterRegistry(adapter: AiToolAdapter) {
  return {
    all: () => [adapter],
    get: () => adapter,
  } as never;
}

function fakeAdapter(onScan: () => void): AiToolAdapter {
  const configFile: ConfigFileSummary = {
    id: 'config-a',
    tool: 'codex',
    name: 'config.toml',
    path: '/tmp/config.toml',
    format: 'toml',
    size: 1,
    category: 'config',
    editable: true,
    formKind: 'toml-config',
    hiddenFromConfigPage: false,
  };
  return {
    tool: 'codex',
    rootPath: '/tmp/.codex',
    isAvailable: () => true,
    listConfigFiles: async () => [configFile],
    getConfigFile: async () => undefined,
    scanSessions: async () => {
      onScan();
      return [{
        id: 'session-a',
        tool: 'codex',
        title: 'Session A',
        projectPath: '/tmp/project',
        sourcePath: '/tmp/session.jsonl',
        messageCount: 1,
        preview: 'hello',
      }];
    },
    readSession: async () => {
      throw new Error('not needed');
    },
    deleteSession: async () => {
      throw new Error('not needed');
    },
    readLogs: async () => [],
  };
}

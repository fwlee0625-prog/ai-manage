import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { RuntimeSyncService } from '../src/runtime/runtime-sync.service.js';

describe('RuntimeSyncService', () => {
  it('adopts an already recognizable live provider without rewriting live files', async () => {
    const summaries = [
      { tool: 'codex', syncStatus: 'externally_modified', actualProviderMatchId: 'p-live' },
      { tool: 'codex', syncStatus: 'synced', managedProviderId: 'p-live', actualProviderMatchId: 'p-live' },
    ];
    let summaryIndex = 0;
    const detector = { summary: async () => summaries[Math.min(summaryIndex++, summaries.length - 1)] };
    const activeCalls: Array<[string, string]> = [];
    const runtime = { setActive: async (tool: string, providerId: string) => { activeCalls.push([tool, providerId]); } };
    const importer = { importLive: async () => { throw new Error('import should not run'); } };
    const switches = { switchProvider: async () => { throw new Error('switch should not run'); } };

    const service = new RuntimeSyncService(detector as never, runtime as never, importer as never, switches as never);
    const result = await service.adoptLive('codex');

    expect(activeCalls).toEqual([['codex', 'p-live']]);
    expect(result).toMatchObject({ syncStatus: 'synced', managedProviderId: 'p-live' });
  });

  it('imports live configuration before adopting when no provider matches yet', async () => {
    const summaries = [
      { tool: 'claude', syncStatus: 'unmanaged' },
      { tool: 'claude', syncStatus: 'unmanaged', actualProviderMatchId: 'p-imported' },
      { tool: 'claude', syncStatus: 'synced', managedProviderId: 'p-imported', actualProviderMatchId: 'p-imported' },
    ];
    let summaryIndex = 0;
    let imported = 0;
    const detector = { summary: async () => summaries[Math.min(summaryIndex++, summaries.length - 1)] };
    const runtime = { setActive: async () => undefined };
    const importer = { importLive: async () => { imported += 1; } };
    const switches = { switchProvider: async () => { throw new Error('switch should not run'); } };

    const service = new RuntimeSyncService(detector as never, runtime as never, importer as never, switches as never);
    const result = await service.adoptLive('claude');

    expect(imported).toBe(1);
    expect(result).toMatchObject({ syncStatus: 'synced', managedProviderId: 'p-imported' });
  });

  it('restores the managed provider through SwitchService', async () => {
    const detector = { summary: async () => ({ tool: 'codex', syncStatus: 'externally_modified' }) };
    const runtime = { active: async () => ({ tool: 'codex', providerId: 'p-managed', switchedAt: 'now' }) };
    const importer = { importLive: async () => undefined };
    const calls: unknown[] = [];
    const switches = {
      switchProvider: async (request: unknown) => {
        calls.push(request);
        return { success: true, tool: 'codex', providerId: 'p-managed' };
      },
    };

    const service = new RuntimeSyncService(detector as never, runtime as never, importer as never, switches as never);
    const result = await service.restoreManaged('codex');

    expect(calls).toEqual([{ tool: 'codex', providerId: 'p-managed' }]);
    expect(result).toMatchObject({ success: true, providerId: 'p-managed' });
  });

  it('refuses restore when no managed provider is active', async () => {
    const detector = { summary: async () => ({ tool: 'codex', syncStatus: 'unmanaged' }) };
    const runtime = { active: async () => undefined };
    const importer = { importLive: async () => undefined };
    const switches = { switchProvider: async () => ({ success: true }) };

    const service = new RuntimeSyncService(detector as never, runtime as never, importer as never, switches as never);
    await expect(service.restoreManaged('codex')).rejects.toBeInstanceOf(BadRequestException);
  });
});

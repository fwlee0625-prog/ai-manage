import { describe, expect, it } from 'vitest';
import type { AiProviderProfile, AiTool, RuntimeSummary } from '@ai-manage/shared';
import type { AccountsService } from '../src/accounts/accounts.service.js';
import type { CredentialStoreService } from '../src/credentials/credential-store.service.js';
import type { ProvidersRepository } from '../src/providers/providers.repository.js';
import type { LiveFileWriterService } from '../src/runtime/live-file-writer.service.js';
import type { RuntimeDetectorService } from '../src/runtime/runtime-detector.service.js';
import type { RuntimeRepository } from '../src/runtime/runtime.repository.js';
import type { SnapshotService } from '../src/runtime/snapshot.service.js';
import { SwitchService } from '../src/runtime/switch.service.js';

function provider(id: string, tool: AiTool = 'codex'): AiProviderProfile {
  return { id, tool, name: id, providerType: id, authMode: 'none', metadata: { liveKey: id }, createdAt: 'now', updatedAt: 'now' };
}

function summary(tool: AiTool, providerId: string): RuntimeSummary {
  return { tool, managedProviderId: providerId, actualProviderMatchId: providerId, syncStatus: 'synced' };
}

function harness(options: { writeError?: Error; verify?: boolean; commitError?: Error; writeDelayMs?: number } = {}) {
  const events: string[] = [];
  const histories: Array<Record<string, unknown>> = [];
  let concurrentWrites = 0;
  let maxConcurrentWrites = 0;
  const providers = { get: async (id: string) => provider(id, id.startsWith('claude') ? 'claude' : 'codex') } as unknown as ProvidersRepository;
  const credentials = { hasCredential: async () => true, readApiKey: async () => 'secret' } as unknown as CredentialStoreService;
  const accounts = { authBundle: async () => { throw new Error('not used'); } } as unknown as AccountsService;
  const writer = {
    readLive: async () => ({ config: {}, auth: {} }),
    writeProjection: async (_tool: AiTool) => {
      events.push('write:start');
      concurrentWrites += 1;
      maxConcurrentWrites = Math.max(maxConcurrentWrites, concurrentWrites);
      try {
        if (options.writeDelayMs) await new Promise(resolve => setTimeout(resolve, options.writeDelayMs));
        if (options.writeError) throw options.writeError;
      } finally {
        concurrentWrites -= 1;
        events.push('write:end');
      }
    },
  } as unknown as LiveFileWriterService;
  const snapshots = { capture: async (tool: AiTool) => ({ tool, files: [] }), restore: async () => { events.push('restore'); } } as unknown as SnapshotService;
  const detector = { matchesProvider: async () => options.verify ?? true, summary: async (tool: AiTool) => summary(tool, 'current') } as unknown as RuntimeDetectorService;
  const runtime = {
    active: async () => undefined,
    setActive: async (tool: AiTool, providerId: string) => { events.push('commit'); if (options.commitError) throw options.commitError; return { tool, providerId, switchedAt: 'now' }; },
    addHistory: async (entry: Record<string, unknown>) => { histories.push(entry); return { id: 'history', createdAt: 'now', ...entry }; },
  } as unknown as RuntimeRepository;
  return { service: new SwitchService(providers, credentials, accounts, writer, snapshots, detector, runtime), events, histories, maxConcurrentWrites: () => maxConcurrentWrites };
}

describe('SwitchService transaction safety', () => {
  it('restores the snapshot when live writing fails', async () => {
    const h = harness({ writeError: new Error('write failed') });
    const result = await h.service.switchProvider({ tool: 'codex', providerId: 'target' });
    expect(result).toMatchObject({ success: false, stage: 'write_live', rolledBack: true });
    expect(h.events).toContain('restore');
    expect(h.histories.at(-1)).toMatchObject({ status: 'failed', failedStage: 'write_live', rolledBack: true });
  });

  it('restores the snapshot when runtime verification fails', async () => {
    const h = harness({ verify: false });
    const result = await h.service.switchProvider({ tool: 'codex', providerId: 'target' });
    expect(result).toMatchObject({ success: false, stage: 'verify', rolledBack: true });
    expect(h.events).toContain('restore');
  });

  it('restores the snapshot when active profile commit fails', async () => {
    const h = harness({ commitError: new Error('commit failed') });
    const result = await h.service.switchProvider({ tool: 'codex', providerId: 'target' });
    expect(result).toMatchObject({ success: false, stage: 'commit_active', rolledBack: true });
    expect(h.events).toEqual(expect.arrayContaining(['commit', 'restore']));
  });

  it('serializes concurrent switches for the same tool', async () => {
    const h = harness({ writeDelayMs: 10 });
    const [first, second] = await Promise.all([
      h.service.switchProvider({ tool: 'codex', providerId: 'first' }),
      h.service.switchProvider({ tool: 'codex', providerId: 'second' }),
    ]);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(h.maxConcurrentWrites()).toBe(1);
  });

  it('allows different tools to switch concurrently', async () => {
    const h = harness({ writeDelayMs: 10 });
    const [codex, claude] = await Promise.all([
      h.service.switchProvider({ tool: 'codex', providerId: 'codex-one' }),
      h.service.switchProvider({ tool: 'claude', providerId: 'claude-one' }),
    ]);
    expect(codex.success).toBe(true);
    expect(claude.success).toBe(true);
    expect(h.maxConcurrentWrites()).toBe(2);
  });
});

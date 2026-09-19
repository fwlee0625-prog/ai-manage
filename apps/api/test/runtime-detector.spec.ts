import { describe, expect, it } from 'vitest';
import type { AiProviderProfile } from '@ai-manage/shared';
import { RuntimeDetectorService } from '../src/runtime/runtime-detector.service.js';

const provider: AiProviderProfile = {
  id: 'p1',
  tool: 'codex',
  name: 'Managed OpenAI',
  providerType: 'openai',
  defaultModel: 'gpt-test',
  authMode: 'managed_account',
  accountId: 'a1',
  metadata: { liveKey: 'openai' },
  createdAt: 'now',
  updatedAt: 'now',
};

describe('RuntimeDetectorService', () => {
  it('reports externally_modified when live provider no longer matches managed state', async () => {
    const writer = { readLive: async () => ({ config: { model_provider: 'other', model: 'gpt-test', model_providers: {} }, auth: {} }) };
    const providers = { list: async () => [provider] };
    const runtime = { active: async () => ({ tool: 'codex', providerId: 'p1', switchedAt: 'now' }) };
    const accounts = { get: async () => ({ id: 'a1', status: 'active', authProvider: 'codex_oauth', isDefault: true, createdAt: 'now', updatedAt: 'now' }) };
    const detector = new RuntimeDetectorService(writer as never, providers as never, runtime as never, accounts as never);
    expect((await detector.summary('codex')).syncStatus).toBe('externally_modified');
  });

  it('reports reauth_required for a managed account that needs login', async () => {
    const writer = { readLive: async () => ({ config: { model_provider: 'openai', model: 'gpt-test', model_providers: { openai: {} } }, auth: {} }) };
    const providers = { list: async () => [provider] };
    const runtime = { active: async () => ({ tool: 'codex', providerId: 'p1', switchedAt: 'now' }) };
    const accounts = { get: async () => ({ id: 'a1', status: 'reauth_required', authProvider: 'codex_oauth', isDefault: true, createdAt: 'now', updatedAt: 'now' }) };
    const detector = new RuntimeDetectorService(writer as never, providers as never, runtime as never, accounts as never);
    expect((await detector.summary('codex')).syncStatus).toBe('reauth_required');
  });
});

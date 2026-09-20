import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiProviderProfile } from '@ai-manage/shared';
import { ProviderToolsService } from '../src/providers/provider-tools.service.js';

const provider: AiProviderProfile = {
  id: 'p1',
  tool: 'codex',
  name: 'Test Provider',
  providerType: 'custom',
  endpoint: 'https://example.test/v1',
  authMode: 'none',
  metadata: {},
  createdAt: 'now',
  updatedAt: 'now',
};

describe('ProviderToolsService health status', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function service() {
    const providers = { get: async () => provider };
    const credentials = {
      hasCredential: async () => false,
      readApiKey: async () => undefined,
    };
    const accounts = { authBundle: async () => { throw new Error('not used'); } };
    return new ProviderToolsService(providers as never, credentials as never, accounts as never);
  }

  it.each([
    [401, 'auth_error'],
    [403, 'auth_error'],
    [500, 'unreachable'],
    [400, 'invalid_config'],
  ] as const)('maps HTTP %s to %s', async (status, expected) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })));
    const result = await service().testProvider(provider.id);
    expect(result.ok).toBe(false);
    expect(result.healthStatus).toBe(expected);
  });

  it('does not permanently classify native-login providers from a synthetic network test', async () => {
    const native = { ...provider, authMode: 'native_login' as const };
    const providers = { get: async () => native };
    const credentials = {};
    const accounts = {};
    const result = await new ProviderToolsService(providers as never, credentials as never, accounts as never)
      .testProvider(native.id);

    expect(result).toMatchObject({ ok: true, healthStatus: 'unknown', stage: 'validate' });
  });
});

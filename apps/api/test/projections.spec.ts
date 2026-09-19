import { describe, expect, it } from 'vitest';
import type { AiProviderProfile } from '@ai-manage/shared';
import { buildClaudeProjection } from '../src/projections/claude-projection.js';
import { buildCodexProjection } from '../src/projections/codex-projection.js';

function provider(overrides: Partial<AiProviderProfile> = {}): AiProviderProfile {
  return {
    id: 'provider-1', tool: 'codex', name: 'Provider', providerType: 'custom',
    authMode: 'api_key', metadata: { liveKey: 'custom' },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('provider projections', () => {
  it('preserves unrelated Codex config fields', () => {
    const result = buildCodexProjection({
      provider: provider({ endpoint: 'https://example.test', defaultModel: 'gpt-x', reasoningEffort: 'high' }),
      credential: 'secret',
      currentConfig: { projects: { '/tmp/a': { trust_level: 'trusted' } }, features: { one: true }, mcp_servers: { demo: { command: 'x' } }, unknown: 42 },
      currentAuth: { tokens: { keep: true } },
    });
    expect(result.config.projects).toEqual({ '/tmp/a': { trust_level: 'trusted' } });
    expect(result.config.features).toEqual({ one: true });
    expect(result.config.mcp_servers).toEqual({ demo: { command: 'x' } });
    expect(result.config.unknown).toBe(42);
    expect(result.config.model_providers).toMatchObject({
      custom: { requires_openai_auth: true },
    });
    expect((result.config.model_providers as Record<string, Record<string, unknown>>).custom?.env_key).toBeUndefined();
    expect(result.auth).toMatchObject({ auth_mode: 'apikey', OPENAI_API_KEY: 'secret' });
    expect(result.auth?.tokens).toBeUndefined();
  });

  it('does not overwrite native Codex auth material', () => {
    const result = buildCodexProjection({
      provider: provider({ providerType: 'openai', authMode: 'native_login', metadata: { liveKey: 'openai' } }),
      currentConfig: {},
      currentAuth: { auth_mode: 'chatgpt', tokens: { keep: true } },
    });
    expect(result.authTouched).toBe(false);
    expect(result.auth).toEqual({ auth_mode: 'chatgpt', tokens: { keep: true } });
  });

  it('preserves unrelated Claude settings and env fields', () => {
    const result = buildClaudeProjection({
      provider: provider({ tool: 'claude', providerType: 'anthropic-compatible', endpoint: 'https://claude.test', defaultModel: 'claude-x' }),
      credential: 'secret',
      currentConfig: { permissions: { allow: ['x'] }, plugins: { demo: true }, hooks: { a: 1 }, env: { KEEP_ME: 'yes', ANTHROPIC_BASE_URL: 'old' } },
    });
    expect(result.config.permissions).toEqual({ allow: ['x'] });
    expect(result.config.plugins).toEqual({ demo: true });
    expect(result.config.hooks).toEqual({ a: 1 });
    expect(result.config.env).toMatchObject({ KEEP_ME: 'yes', ANTHROPIC_BASE_URL: 'https://claude.test', ANTHROPIC_API_KEY: 'secret', ANTHROPIC_MODEL: 'claude-x' });
  });
});

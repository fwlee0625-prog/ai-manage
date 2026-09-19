import { describe, expect, it } from 'vitest';
import type { AiProviderProfile } from '@ai-manage/shared';
import { buildCodexProjection } from '../src/projections/codex-projection.js';

describe('Codex managed account projection', () => {
  it('projects ChatGPT tokens while preserving unrelated auth fields', () => {
    const provider: AiProviderProfile = {
      id: 'p1', tool: 'codex', name: 'OpenAI Account', providerType: 'openai',
      authMode: 'managed_account', accountId: 'a1', metadata: { liveKey: 'openai' },
      createdAt: 'now', updatedAt: 'now',
    };
    const idPayload = Buffer.from(JSON.stringify({
      email: 'u@example.com',
      'https://api.openai.com/auth': { chatgpt_user_id: 'u1', chatgpt_account_id: 'w1' },
    })).toString('base64url');
    const result = buildCodexProjection({
      provider,
      currentConfig: { features: { keep: true } },
      currentAuth: { other: { keep: true }, OPENAI_API_KEY: 'old' },
      account: {
        idToken: `x.${idPayload}.x`,
        accessToken: 'access',
        refreshToken: 'refresh',
        identity: { email: 'u@example.com', identitySubject: 'u1', externalAccountId: 'w1', isFedramp: false },
      },
    });
    expect(result.authTouched).toBe(true);
    expect(result.auth?.OPENAI_API_KEY).toBeUndefined();
    expect(result.auth?.other).toEqual({ keep: true });
    expect(result.auth?.auth_mode).toBe('chatgpt');
    expect(result.auth?.tokens).toMatchObject({ access_token: 'access', refresh_token: 'refresh', account_id: 'w1' });
    expect(result.config.features).toEqual({ keep: true });
  });
});

import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { CodexOAuthService, parseCodexIdentity } from '../src/accounts/oauth/codex-oauth.service.js';
import { CodexOAuthStoreService } from '../src/accounts/oauth/codex-oauth-store.service.js';

function jwt(payload: Record<string, unknown>) {
  return `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.x`;
}

describe('CodexOAuthService', () => {
  it('parses user identity separately from workspace account id', () => {
    const token = jwt({
      sub: 'subject-fallback',
      email: 'user@example.com',
      'https://api.openai.com/auth': {
        chatgpt_user_id: 'user-1',
        chatgpt_account_id: 'workspace-1',
        chatgpt_plan_type: 'team',
      },
    });
    expect(parseCodexIdentity(token)).toMatchObject({
      email: 'user@example.com',
      identitySubject: 'user-1',
      externalAccountId: 'workspace-1',
      planType: 'team',
    });
  });

  it('completes device auth and keeps access token out of the file store', async () => {
    const dir = await mkdtemp(resolve(tmpdir(), 'ai-manage-oauth-'));
    const store = CodexOAuthStoreService.forFile(resolve(dir, 'oauth.json'));
    const idToken = jwt({ sub: 'user-1', email: 'u@example.com', 'https://api.openai.com/auth': { chatgpt_account_id: 'workspace-1' } });
    const accessToken = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const responses = [
      new Response(JSON.stringify({ device_auth_id: 'device-1', user_code: 'ABCD', interval: '1' }), { status: 200 }),
      new Response(JSON.stringify({ authorization_code: 'code', code_verifier: 'verifier', code_challenge: 'challenge' }), { status: 200 }),
      new Response(JSON.stringify({ id_token: idToken, access_token: accessToken, refresh_token: 'refresh-1' }), { status: 200 }),
    ];
    const fetchMock = (async () => responses.shift()!) as typeof fetch;
    const service = CodexOAuthService.forTesting(store, fetchMock);
    const start = await service.startDeviceLogin();
    const poll = await service.poll(start.loginId);
    expect(poll.status).toBe('complete');
    await service.persistBundle('local-1', poll.bundle!);
    expect((await store.read('local-1')).refreshToken).toBe('refresh-1');
    expect(await service.tokenBundle('local-1')).toMatchObject({ accessToken });
  });
});

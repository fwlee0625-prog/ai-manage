import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { CodexOAuthStoreService } from '../src/accounts/oauth/codex-oauth-store.service.js';

describe('CodexOAuthStoreService', () => {
  it('stores refresh and id tokens by stable local account id', async () => {
    const dir = await mkdtemp(resolve(tmpdir(), 'ai-manage-oauth-store-'));
    const store = CodexOAuthStoreService.forFile(resolve(dir, 'codex-oauth.json'));
    await store.save('account-local', { refreshToken: 'refresh-secret', idToken: 'id-secret', updatedAt: 'now' });
    expect(await store.read('account-local')).toMatchObject({ refreshToken: 'refresh-secret', idToken: 'id-secret' });
    await store.delete('account-local');
    await expect(store.read('account-local')).rejects.toThrow();
  });
});

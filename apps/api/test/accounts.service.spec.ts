import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { CodexOAuthService, CodexOAuthTokenBundle, OAuthPollResult } from '../src/accounts/oauth/codex-oauth.service.js';
import { AccountsRepository } from '../src/accounts/accounts.repository.js';
import { AccountsService } from '../src/accounts/accounts.service.js';
import { ManageRepository } from '../src/database/manage.repository.js';
import type { ProvidersRepository } from '../src/providers/providers.repository.js';

function bundle(user: string, workspace: string, email = user + '@example.com'): CodexOAuthTokenBundle {
  return {
    idToken: 'id-token',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    identity: { email, identitySubject: user, externalAccountId: workspace, isFedramp: false },
  };
}

async function harness(polls: OAuthPollResult[]) {
  const dir = await mkdtemp(resolve(tmpdir(), 'ai-manage-accounts-'));
  const manage = ManageRepository.forDatabase(resolve(dir, 'manage.sqlite'));
  await manage.init();
  const repository = new AccountsRepository(manage);
  const persisted: string[] = [];
  const oauth = {
    poll: async () => polls.shift()!,
    persistBundle: async (id: string) => { persisted.push(id); },
    startDeviceLogin: async () => ({ loginId: 'login', verificationUrl: 'https://example.test', userCode: 'CODE', intervalSeconds: 5, expiresAt: '2099-01-01T00:00:00.000Z' }),
    deleteAccountCredential: async () => undefined,
    tokenBundle: async () => bundle('user', 'workspace'),
  } as unknown as CodexOAuthService;
  const providers = { list: async () => [] } as unknown as ProvidersRepository;
  return { service: new AccountsService(repository, oauth, providers), repository, persisted };
}

describe('AccountsService multi-account behavior', () => {
  it('keeps two different ChatGPT identities as separate local accounts', async () => {
    const h = await harness([
      { status: 'complete', bundle: bundle('user-a', 'workspace-a') },
      { status: 'complete', bundle: bundle('user-b', 'workspace-b') },
    ]);
    const first = await h.service.pollDeviceLogin('one');
    const second = await h.service.pollDeviceLogin('two');
    expect(first.account?.id).toBeTruthy();
    expect(second.account?.id).toBeTruthy();
    expect(second.account?.id).not.toBe(first.account?.id);
    expect(await h.service.list()).toHaveLength(2);
  });

  it('deduplicates the same identity and workspace to the stable local UUID', async () => {
    const h = await harness([
      { status: 'complete', bundle: bundle('user-a', 'workspace-a') },
      { status: 'complete', bundle: bundle('user-a', 'workspace-a', 'renamed@example.com') },
    ]);
    const first = await h.service.pollDeviceLogin('one');
    const second = await h.service.pollDeviceLogin('two');
    expect(second.account?.id).toBe(first.account?.id);
    expect(await h.service.list()).toHaveLength(1);
    expect(h.persisted).toEqual([first.account?.id, first.account?.id]);
  });

  it('rejects reauthentication when it returns a different identity', async () => {
    const h = await harness([{ status: 'complete', bundle: bundle('user-b', 'workspace-a'), existingAccountId: 'account-a' }]);
    await h.repository.save({
      id: 'account-a',
      authProvider: 'codex_oauth',
      displayName: 'A',
      email: 'a@example.com',
      identitySubject: 'user-a',
      externalAccountId: 'workspace-a',
      status: 'active',
      isDefault: true,
      createdAt: 'now',
      updatedAt: 'now',
    });
    await expect(h.service.pollDeviceLogin('reauth')).rejects.toThrow('different ChatGPT identity');
  });
});

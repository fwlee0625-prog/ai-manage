import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ManagedAccount, PollDeviceLoginResponse, StartDeviceLoginResponse } from '@ai-manage/shared';
import { randomUUID } from 'node:crypto';
import { ProvidersRepository } from '../providers/providers.repository.js';
import { AccountsRepository } from './accounts.repository.js';
import { CodexOAuthService, type CodexOAuthTokenBundle } from './oauth/codex-oauth.service.js';

@Injectable()
export class AccountsService {
  constructor(
    private readonly repository: AccountsRepository,
    private readonly oauth: CodexOAuthService,
    private readonly providers: ProvidersRepository,
  ) {}

  /** Lists managed Codex OAuth accounts without token material. */
  list(): Promise<ManagedAccount[]> {
    return this.repository.list('codex_oauth');
  }

  /** Starts a new ChatGPT device-code authorization. */
  startDeviceLogin(): Promise<StartDeviceLoginResponse> {
    return this.oauth.startDeviceLogin();
  }

  /** Polls a device login and persists account metadata/token material on completion. */
  async pollDeviceLogin(loginId: string): Promise<PollDeviceLoginResponse> {
    const result = await this.oauth.poll(loginId);
    if (result.status !== 'complete' || !result.bundle) return { status: result.status };

    const identity = result.bundle.identity;
    const reauth = result.existingAccountId ? await this.repository.get(result.existingAccountId) : undefined;
    const duplicate = await this.repository.findIdentity(identity.identitySubject, identity.externalAccountId);
    const current = reauth || duplicate;
    const id = current?.id || randomUUID();
    const now = new Date().toISOString();
    const count = (await this.repository.list()).length;
    const account: ManagedAccount = {
      id,
      authProvider: 'codex_oauth',
      displayName: identity.email || current?.displayName || 'ChatGPT Account',
      email: identity.email,
      externalAccountId: identity.externalAccountId,
      identitySubject: identity.identitySubject,
      authenticatedAt: now,
      tokenUpdatedAt: now,
      status: 'active',
      isDefault: current?.isDefault ?? count === 0,
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };
    await this.oauth.persistBundle(id, result.bundle);
    await this.repository.save(account);
    return { status: 'complete', account };
  }

  /** Starts device reauthentication while preserving the local account UUID. */
  async reauth(id: string): Promise<StartDeviceLoginResponse> {
    if (!await this.repository.get(id)) throw new NotFoundException('Account not found');
    return this.oauth.startDeviceLogin(id);
  }

  /** Sets one account as the default managed Codex account. */
  async setDefault(id: string): Promise<ManagedAccount> {
    if (!await this.repository.get(id)) throw new NotFoundException('Account not found');
    await this.repository.setDefault(id);
    return (await this.repository.get(id))!;
  }

  /** Deletes an unbound managed account and its secret credential material. */
  async delete(id: string): Promise<void> {
    const account = await this.repository.get(id);
    if (!account) return;
    const bound = (await this.providers.list('codex')).some(provider => provider.accountId === id);
    if (bound) throw new BadRequestException('Account is still bound to a Provider');
    await this.oauth.deleteAccountCredential(id);
    await this.repository.delete(id);
  }

  /** Resolves a fresh OAuth bundle for SwitchService and updates lifecycle status. */
  async authBundle(id: string): Promise<CodexOAuthTokenBundle> {
    const account = await this.repository.get(id);
    if (!account) throw new NotFoundException('Managed account not found');
    try {
      const bundle = await this.oauth.tokenBundle(id);
      if (account.status !== 'active') await this.repository.setStatus(id, 'active');
      return bundle;
    } catch {
      await this.repository.setStatus(id, 'reauth_required');
      throw new BadRequestException('Managed account requires reauthentication');
    }
  }
}

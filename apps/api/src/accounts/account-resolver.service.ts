import { Injectable } from '@nestjs/common';
import { AccountBindingsRepository } from './account-bindings.repository.js';
import { AccountsRepository } from './accounts.repository.js';
import type { ManagedAccount } from '@ai-manage/shared';

/** Resolves the runtime account identity behind a provider. */
@Injectable()
export class AccountResolverService {
  constructor(
    private readonly bindings: AccountBindingsRepository,
    private readonly accounts: AccountsRepository,
  ) {}

  /**
   * Finds the highest priority usable account bound to a provider.
   * The legacy provider.accountId fallback is intentionally handled by the caller
   * during migration so existing installations continue to work.
   */
  async resolve(providerId: string): Promise<ManagedAccount | undefined> {
    const candidates = await this.bindings.listByProvider(providerId);
    for (const binding of candidates) {
      const account = await this.accounts.get(binding.accountId);
      if (account && account.status === 'active') return account;
    }
    return undefined;
  }
}

import { Injectable } from '@nestjs/common';
import type { AccountStatus, ManagedAccount } from '@ai-manage/shared';
import { ManageRepository } from '../database/manage.repository.js';
import { sqlString } from '../database/sqlite-database.js';

interface AccountRow {
  id: string;
  auth_provider: 'codex_oauth';
  display_name?: string | null;
  email?: string | null;
  external_account_id?: string | null;
  identity_subject?: string | null;
  authenticated_at?: string | null;
  token_updated_at?: string | null;
  status: AccountStatus;
  is_default: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AccountsRepository {
  constructor(private readonly manage: ManageRepository) {}

  /** Lists managed accounts for one auth provider. */
  async list(authProvider: 'codex_oauth' = 'codex_oauth'): Promise<ManagedAccount[]> {
    const rows = await this.manage.all<AccountRow>(`
      SELECT * FROM managed_accounts
      WHERE auth_provider = ${sqlString(authProvider)}
      ORDER BY is_default DESC, updated_at DESC;
    `);
    return rows.map(mapAccount);
  }

  /** Reads one managed account by local UUID. */
  async get(id: string): Promise<ManagedAccount | undefined> {
    const rows = await this.manage.all<AccountRow>(
      `SELECT * FROM managed_accounts WHERE id = ${sqlString(id)} LIMIT 1;`,
    );
    return rows[0] ? mapAccount(rows[0]) : undefined;
  }

  /** Finds an existing identity without using workspace id as the primary key. */
  async findIdentity(identitySubject?: string, externalAccountId?: string): Promise<ManagedAccount | undefined> {
    if (!identitySubject) return undefined;
    const rows = await this.manage.all<AccountRow>(`
      SELECT * FROM managed_accounts
      WHERE auth_provider = 'codex_oauth'
        AND identity_subject = ${sqlString(identitySubject)}
        AND COALESCE(external_account_id, '') = ${sqlString(externalAccountId || '')}
      LIMIT 1;
    `);
    return rows[0] ? mapAccount(rows[0]) : undefined;
  }

  /** Inserts or updates one managed account metadata record. */
  async save(account: ManagedAccount): Promise<void> {
    await this.manage.exec(`
      INSERT INTO managed_accounts (
        id, auth_provider, display_name, email, external_account_id, identity_subject,
        authenticated_at, token_updated_at, status, is_default, created_at, updated_at
      ) VALUES (
        ${sqlString(account.id)}, ${sqlString(account.authProvider)}, ${sqlString(account.displayName)},
        ${sqlString(account.email)}, ${sqlString(account.externalAccountId)}, ${sqlString(account.identitySubject)},
        ${sqlString(account.authenticatedAt)}, ${sqlString(account.tokenUpdatedAt)}, ${sqlString(account.status)},
        ${account.isDefault ? 1 : 0}, ${sqlString(account.createdAt)}, ${sqlString(account.updatedAt)}
      )
      ON CONFLICT(id) DO UPDATE SET
        display_name=excluded.display_name,
        email=excluded.email,
        external_account_id=excluded.external_account_id,
        identity_subject=excluded.identity_subject,
        authenticated_at=excluded.authenticated_at,
        token_updated_at=excluded.token_updated_at,
        status=excluded.status,
        is_default=excluded.is_default,
        updated_at=excluded.updated_at;
    `);
  }

  /** Makes one account the default for its auth provider. */
  async setDefault(id: string): Promise<void> {
    await this.manage.transaction([
      "UPDATE managed_accounts SET is_default = 0 WHERE auth_provider = 'codex_oauth';",
      `UPDATE managed_accounts SET is_default = 1, updated_at = ${sqlString(new Date().toISOString())} WHERE id = ${sqlString(id)};`,
    ]);
  }

  /** Updates account lifecycle status after refresh failures or recovery. */
  async setStatus(id: string, status: AccountStatus): Promise<void> {
    await this.manage.exec(`
      UPDATE managed_accounts
      SET status=${sqlString(status)}, updated_at=${sqlString(new Date().toISOString())}
      WHERE id=${sqlString(id)};
    `);
  }

  /** Marks token material as freshly validated or refreshed. */
  async touchToken(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.manage.exec(`
      UPDATE managed_accounts
      SET token_updated_at=${sqlString(now)}, status='active', updated_at=${sqlString(now)}
      WHERE id=${sqlString(id)};
    `);
  }

  /** Deletes one account metadata record. */
  async delete(id: string): Promise<void> {
    await this.manage.exec(`DELETE FROM managed_accounts WHERE id=${sqlString(id)};`);
  }
}

function mapAccount(row: AccountRow): ManagedAccount {
  return {
    id: row.id,
    authProvider: row.auth_provider,
    displayName: row.display_name || undefined,
    email: row.email || undefined,
    externalAccountId: row.external_account_id || undefined,
    identitySubject: row.identity_subject || undefined,
    authenticatedAt: row.authenticated_at || undefined,
    tokenUpdatedAt: row.token_updated_at || undefined,
    status: row.status,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

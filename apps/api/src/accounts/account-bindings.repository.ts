import { Injectable } from '@nestjs/common';
import type { AccountBinding, AccountBindingPurpose } from '@ai-manage/shared';
import { ManageRepository } from '../database/manage.repository.js';
import { sqlString } from '../database/sqlite-database.js';

interface BindingRow {
  id: string;
  provider_id: string;
  account_id: string;
  purpose: AccountBindingPurpose;
  priority: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AccountBindingsRepository {
  constructor(private readonly manage: ManageRepository) {}

  async listByProvider(providerId: string): Promise<AccountBinding[]> {
    const rows = await this.manage.all<BindingRow>(`
      SELECT * FROM account_provider_bindings
      WHERE provider_id=${sqlString(providerId)}
      ORDER BY priority DESC, created_at ASC;
    `);
    return rows.map(mapBinding);
  }

  async create(binding: AccountBinding): Promise<void> {
    await this.manage.exec(`
      INSERT INTO account_provider_bindings
      (id, provider_id, account_id, purpose, priority, created_at, updated_at)
      VALUES (
        ${sqlString(binding.id)},
        ${sqlString(binding.providerId)},
        ${sqlString(binding.accountId)},
        ${sqlString(binding.purpose)},
        ${binding.priority},
        ${sqlString(binding.createdAt)},
        ${sqlString(binding.updatedAt)}
      );
    `);
  }

  async delete(id: string): Promise<void> {
    await this.manage.exec(`DELETE FROM account_provider_bindings WHERE id=${sqlString(id)};`);
  }
}

function mapBinding(row: BindingRow): AccountBinding {
  return {
    id: row.id,
    providerId: row.provider_id,
    accountId: row.account_id,
    purpose: row.purpose,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

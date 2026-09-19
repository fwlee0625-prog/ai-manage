import { Injectable } from '@nestjs/common';
import type { AiProviderProfile, AiTool } from '@ai-manage/shared';
import { ManageRepository } from '../database/manage.repository.js';
import { sqlString } from '../database/sqlite-database.js';
import { providerFromRow, type ProviderRow } from './provider.mapper.js';

@Injectable()
export class ProvidersRepository {
  constructor(private readonly manage: ManageRepository) {}

  /** Lists providers from manage.sqlite. */
  async list(tool?: AiTool): Promise<AiProviderProfile[]> {
    const rows = await this.manage.all<ProviderRow>(`SELECT * FROM providers ${tool ? `WHERE tool = ${sqlString(tool)}` : ''} ORDER BY updated_at DESC, name ASC;`);
    return rows.map(providerFromRow);
  }

  /** Reads one provider. */
  async get(id: string): Promise<AiProviderProfile | undefined> {
    const rows = await this.manage.all<ProviderRow>(`SELECT * FROM providers WHERE id = ${sqlString(id)} LIMIT 1;`);
    return rows[0] ? providerFromRow(rows[0]) : undefined;
  }

  /** Inserts or updates a complete provider profile. */
  async save(provider: AiProviderProfile): Promise<void> {
    await this.manage.exec(`
      INSERT INTO providers (id, tool, name, provider_type, endpoint, api_protocol, default_model, reasoning_effort, auth_mode, account_id, credential_id, metadata_json, created_at, updated_at)
      VALUES (${sqlString(provider.id)}, ${sqlString(provider.tool)}, ${sqlString(provider.name)}, ${sqlString(provider.providerType)}, ${sqlString(provider.endpoint)}, ${sqlString(provider.apiProtocol)}, ${sqlString(provider.defaultModel)}, ${sqlString(provider.reasoningEffort)}, ${sqlString(provider.authMode)}, ${sqlString(provider.accountId)}, ${sqlString(provider.credentialId)}, ${sqlString(JSON.stringify(provider.metadata || {}))}, ${sqlString(provider.createdAt)}, ${sqlString(provider.updatedAt)})
      ON CONFLICT(id) DO UPDATE SET tool=excluded.tool, name=excluded.name, provider_type=excluded.provider_type, endpoint=excluded.endpoint, api_protocol=excluded.api_protocol, default_model=excluded.default_model, reasoning_effort=excluded.reasoning_effort, auth_mode=excluded.auth_mode, account_id=excluded.account_id, credential_id=excluded.credential_id, metadata_json=excluded.metadata_json, updated_at=excluded.updated_at;
    `);
  }

  /** Deletes one provider. */
  async delete(id: string): Promise<void> { await this.manage.exec(`DELETE FROM providers WHERE id = ${sqlString(id)};`); }
}

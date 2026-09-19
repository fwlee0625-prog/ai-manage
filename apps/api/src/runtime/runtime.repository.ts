import { Injectable } from '@nestjs/common';
import type { AiTool, SwitchHistoryEntry } from '@ai-manage/shared';
import { randomUUID } from 'node:crypto';
import { ManageRepository } from '../database/manage.repository.js';
import { sqlString } from '../database/sqlite-database.js';

export interface ActiveProfileRow {
  tool: AiTool;
  providerId: string;
  switchedAt: string;
}

@Injectable()
export class RuntimeRepository {
  constructor(private readonly manage: ManageRepository) {}

  /** Reads the managed active provider for one tool. */
  async active(tool: AiTool): Promise<ActiveProfileRow | undefined> {
    const rows = await this.manage.all<{ tool: AiTool; provider_id: string; switched_at: string }>(
      `SELECT tool, provider_id, switched_at FROM active_profiles WHERE tool = ${sqlString(tool)} LIMIT 1;`,
    );
    const row = rows[0];
    return row ? { tool: row.tool, providerId: row.provider_id, switchedAt: row.switched_at } : undefined;
  }

  /** Commits the active provider only after live verification succeeds. */
  async setActive(tool: AiTool, providerId: string): Promise<ActiveProfileRow> {
    const switchedAt = new Date().toISOString();
    await this.manage.exec(`
      INSERT INTO active_profiles (tool, provider_id, switched_at)
      VALUES (${sqlString(tool)}, ${sqlString(providerId)}, ${sqlString(switchedAt)})
      ON CONFLICT(tool) DO UPDATE SET provider_id=excluded.provider_id, switched_at=excluded.switched_at;
    `);
    return { tool, providerId, switchedAt };
  }

  /** Appends one redacted switch history record. */
  async addHistory(entry: Omit<SwitchHistoryEntry, 'id' | 'createdAt'>): Promise<SwitchHistoryEntry> {
    const result: SwitchHistoryEntry = { ...entry, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.manage.exec(`
      INSERT INTO switch_history (id, tool, from_provider_id, to_provider_id, status, failed_stage, error, rolled_back, created_at)
      VALUES (${sqlString(result.id)}, ${sqlString(result.tool)}, ${sqlString(result.fromProviderId)}, ${sqlString(result.toProviderId)}, ${sqlString(result.status)}, ${sqlString(result.failedStage)}, ${sqlString(result.error)}, ${result.rolledBack ? 1 : 0}, ${sqlString(result.createdAt)});
    `);
    return result;
  }

  /** Lists recent switch history for one tool. */
  async history(tool: AiTool, limit = 50): Promise<SwitchHistoryEntry[]> {
    const rows = await this.manage.all<{
      id: string; tool: AiTool; from_provider_id?: string; to_provider_id?: string;
      status: 'success' | 'failed'; failed_stage?: string; error?: string; rolled_back: number; created_at: string;
    }>(`SELECT * FROM switch_history WHERE tool=${sqlString(tool)} ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(limit, 200))};`);
    return rows.map(row => ({
      id: row.id, tool: row.tool, fromProviderId: row.from_provider_id, toProviderId: row.to_provider_id,
      status: row.status, failedStage: row.failed_stage, error: row.error, rolledBack: row.rolled_back === 1, createdAt: row.created_at,
    }));
  }
}

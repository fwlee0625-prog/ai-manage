import type { DatabaseMigration } from './index.migrations.js';

export const MANAGE_MIGRATIONS: DatabaseMigration[] = [{
  version: 1,
  name: 'init-managed-state',
  sql: `
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      endpoint TEXT,
      api_protocol TEXT,
      default_model TEXT,
      reasoning_effort TEXT,
      auth_mode TEXT NOT NULL,
      account_id TEXT,
      credential_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_providers_tool ON providers(tool);
    CREATE TABLE IF NOT EXISTS active_profiles (
      tool TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      switched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS switch_history (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      from_provider_id TEXT,
      to_provider_id TEXT,
      status TEXT NOT NULL,
      failed_stage TEXT,
      error TEXT,
      rolled_back INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_switch_history_tool_created ON switch_history(tool, created_at DESC);
  `,
}];

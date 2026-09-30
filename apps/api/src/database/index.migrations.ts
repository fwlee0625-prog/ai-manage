import { sqlString } from './sqlite-database.js';

export interface DatabaseMigration {
  version: number;
  name: string;
  sql: string;
}

export const INDEX_MIGRATIONS: DatabaseMigration[] = [
  {
    version: 1,
    name: 'init-index-schema',
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT NOT NULL,
        tool TEXT NOT NULL,
        title TEXT NOT NULL,
        project_path TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT,
        source_path TEXT NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        preview TEXT NOT NULL DEFAULT '',
        search_text TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (tool, id)
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_tool ON sessions(tool);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);
      CREATE TABLE IF NOT EXISTS scan_status (
        tool TEXT PRIMARY KEY,
        root_path TEXT NOT NULL,
        available INTEGER NOT NULL,
        last_indexed_at TEXT,
        session_count INTEGER NOT NULL DEFAULT 0,
        config_file_count INTEGER NOT NULL DEFAULT 0,
        error TEXT
      );
    `,
  },
  {
    version: 2,
    name: 'add-session-usage-columns',
    sql: `
      ALTER TABLE sessions ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sessions ADD COLUMN cache_read_tokens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sessions ADD COLUMN cache_write_tokens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sessions ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sessions ADD COLUMN total_tokens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sessions ADD COLUMN tool_call_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sessions ADD COLUMN tool_calls_json TEXT;
      ALTER TABLE sessions ADD COLUMN model TEXT;
      CREATE INDEX IF NOT EXISTS idx_sessions_total_tokens ON sessions(total_tokens);
    `,
  },
  {
    version: 3,
    name: 'add-session-models-json-column',
    sql: `
      ALTER TABLE sessions ADD COLUMN models_json TEXT;
    `,
  },
];

export function migrationInsertStatement(migration: DatabaseMigration): string {
  return `
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES (${migration.version}, ${sqlString(migration.name)}, ${sqlString(new Date().toISOString())});
  `;
}

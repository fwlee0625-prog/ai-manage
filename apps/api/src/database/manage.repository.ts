import { Injectable, OnModuleInit } from '@nestjs/common';
import { resolve } from 'node:path';
import { DATA_DIR } from '../utils.js';
import { migrationInsertStatement } from './index.migrations.js';
import { MANAGE_MIGRATIONS } from './manage.migrations.js';
import { SqliteDatabase } from './sqlite-database.js';

@Injectable()
export class ManageRepository implements OnModuleInit {
  private sqlite = new SqliteDatabase(resolve(DATA_DIR, 'manage.sqlite'));

  static forDatabase(dbPath: string): ManageRepository {
    const repository = new ManageRepository();
    repository.sqlite = new SqliteDatabase(dbPath);
    return repository;
  }

  /** Applies managed-state schema migrations exactly once. */
  async init(): Promise<void> {
    await this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    const applied = await this.sqlite.all<{ version: number }>('SELECT version FROM schema_migrations;');
    const versions = new Set(applied.map(row => Number(row.version)));
    for (const migration of MANAGE_MIGRATIONS) {
      if (versions.has(migration.version)) continue;
      await this.sqlite.transaction([migration.sql, migrationInsertStatement(migration)]);
    }
  }

  async onModuleInit(): Promise<void> { await this.init(); }

  /** Returns applied managed-state migration versions. */
  async appliedMigrationVersions(): Promise<number[]> {
    await this.init();
    const rows = await this.sqlite.all<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version;');
    return rows.map(row => Number(row.version));
  }

  /** Executes managed-state SQL after migrations are ready. */
  async exec(sql: string): Promise<void> { await this.init(); await this.sqlite.exec(sql); }

  /** Queries managed-state rows after migrations are ready. */
  async all<T>(sql: string): Promise<T[]> { await this.init(); return this.sqlite.all<T>(sql); }

  /** Executes a managed-state transaction after migrations are ready. */
  async transaction(statements: string[]): Promise<void> { await this.init(); await this.sqlite.transaction(statements); }
}

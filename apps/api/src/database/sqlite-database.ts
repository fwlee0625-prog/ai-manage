import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class SqliteDatabase {
  private readonly db: DatabaseSync;

  constructor(private readonly dbPath: string) {
    this.db = new DatabaseSync(dbPath);
  }

  async exec(sql: string): Promise<string> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    this.db.exec(sql.trim());
    return '';
  }

  async all<T>(sql: string): Promise<T[]> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    return this.db.prepare(sql.trim()).all() as T[];
  }

  async transaction(statements: string[]): Promise<string> {
    if (!statements.length) return '';
    await mkdir(dirname(this.dbPath), { recursive: true });
    const chunks = statements.map(statement => statement.trim()).filter(Boolean);
    this.db.exec('BEGIN;');
    try {
      for (const statement of chunks) {
        this.db.exec(statement);
      }
      this.db.exec('COMMIT;');
      return '';
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }
}

export function sqlString(value: unknown): string {
  if (value === undefined || value === null) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

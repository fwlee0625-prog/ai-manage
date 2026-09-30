import { BadRequestException } from '@nestjs/common';
import type {
  SqliteCellValue,
  SqliteColumnSummary,
  SqliteTableRows,
  SqliteTableSummary,
} from '@ai-manage/shared';
import { open } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const SQLITE_MAGIC = 'SQLite format 3';
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Checks the 16-byte SQLite magic header so text files renamed to .db fail fast.
 */
export async function hasSqliteMagic(filePath: string): Promise<boolean> {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(SQLITE_MAGIC.length);
    await handle.read(header, 0, header.length, 0);
    return header.toString('latin1') === SQLITE_MAGIC;
  } finally {
    await handle.close();
  }
}

/**
 * Lists user tables and views with row counts from a SQLite file, read-only.
 */
export function readSqliteTables(filePath: string): SqliteTableSummary[] {
  const db = openSqliteReadonly(filePath);
  try {
    const objects = db
      .prepare(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name",
      )
      .all() as Array<{ name: string; type: string }>;
    return objects.map(object => ({
      name: object.name,
      kind: object.type === 'view' ? 'view' : 'table',
      rowCount: countRows(db, object.name),
    }));
  } finally {
    db.close();
  }
}

/**
 * Reads one page of rows plus column metadata from a table or view, read-only.
 *
 * The table name is validated against `sqlite_master` before being quoted as an
 * identifier, so arbitrary SQL can never reach the engine through this path.
 */
export function readSqliteRows(
  filePath: string,
  tableName: string,
  page: number,
  pageSize: number,
): Omit<SqliteTableRows, 'tool' | 'path'> {
  const db = openSqliteReadonly(filePath);
  try {
    assertKnownTable(db, tableName);
    const identifier = quoteIdentifier(tableName);
    const columns = readColumns(db, identifier);
    const total = countRows(db, tableName);
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize) || DEFAULT_PAGE_SIZE));
    const rows = db
      .prepare(`SELECT * FROM ${identifier} LIMIT ? OFFSET ?`)
      .all(safePageSize, (safePage - 1) * safePageSize) as Array<Record<string, unknown>>;
    return {
      table: tableName,
      page: safePage,
      pageSize: safePageSize,
      total,
      columns,
      rows: rows.map(row => {
        const normalized: Record<string, SqliteCellValue> = {};
        for (const [key, value] of Object.entries(row)) {
          normalized[key] = normalizeCellValue(value);
        }
        return normalized;
      }),
    };
  } finally {
    db.close();
  }
}

/**
 * Opens a SQLite database strictly in read-only mode; preview must never mutate tool data.
 */
function openSqliteReadonly(filePath: string): DatabaseSync {
  try {
    return new DatabaseSync(filePath, { readOnly: true });
  } catch (error) {
    throw new BadRequestException(`无法读取 SQLite 文件：${describeSqliteError(error)}`);
  }
}

/**
 * Validates the table name against the sqlite_master whitelist to block identifier injection.
 */
function assertKnownTable(db: DatabaseSync, tableName: string): void {
  if (!tableName) throw new BadRequestException('table is required');
  const objects = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>;
  if (!objects.some(object => object.name === tableName)) {
    throw new BadRequestException('Table not found in this SQLite file');
  }
}

/**
 * Reads column metadata via PRAGMA table_info using the quoted identifier.
 */
function readColumns(db: DatabaseSync, identifier: string): SqliteColumnSummary[] {
  const info = db.prepare(`PRAGMA table_info(${identifier})`).all() as Array<{
    name: string;
    type: string | null;
    notnull: number;
    pk: number;
  }>;
  return info.map(column => ({
    name: column.name,
    type: column.type || '',
    pk: column.pk > 0,
    notNull: column.notnull > 0,
  }));
}

/**
 * Counts rows of one table; failed counts (e.g. exotic virtual tables) degrade to 0.
 */
function countRows(db: DatabaseSync, tableName: string): number {
  try {
    const result = db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`).all() as Array<{
      count: number | bigint;
    }>;
    return Number(result[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Quotes a SQLite identifier; only called after the sqlite_master whitelist check.
 */
function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/**
 * Maps SQLite driver values onto JSON-safe preview cells.
 */
function normalizeCellValue(value: unknown): SqliteCellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return `[BLOB ${value.byteLength} 字节]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Extracts the driver message without leaking stack noise to API consumers.
 */
function describeSqliteError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

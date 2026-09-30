import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiToolAdapter } from '../src/adapters/ai-tool.adapter.js';
import { PathGuard } from '../src/fs/path-guard.js';
import { FilesService } from '../src/routes/files.service.js';

let tempRoot: string;
let dbPath: string;

beforeAll(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'ai-manage-files-sqlite-'));
  dbPath = join(tempRoot, 'sample.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, score REAL, avatar BLOB);
    CREATE TABLE logs (id INTEGER PRIMARY KEY, message TEXT);
    CREATE VIEW user_scores AS SELECT id, score FROM users;
  `);
  const insert = db.prepare('INSERT INTO users (name, score, avatar) VALUES (?, ?, ?)');
  for (let index = 1; index <= 5; index += 1) {
    insert.run(`user-${index}`, index * 0.5, new Uint8Array([1, 2, 3]));
  }
  const insertLog = db.prepare('INSERT INTO logs (message) VALUES (?)');
  insertLog.run('hello');
  db.close();

  writeFileSync(join(tempRoot, 'fake.db'), 'this is not a sqlite database at all');
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

function serviceWithRoot(): FilesService {
  const adapter = {
    tool: 'codex',
    rootPath: tempRoot,
  } as AiToolAdapter;
  const registry = {
    get: (tool: string) => (tool === 'codex' ? adapter : undefined),
    all: () => [adapter],
  };
  return new FilesService(registry as never, PathGuard.forRoots(tempRoot, join(tempRoot, '.claude')));
}

describe('FilesService sqlite preview', () => {
  it('flags sqlite extensions as supported sqlite previews', async () => {
    const service = serviceWithRoot();

    const preview = await service.filePreview('codex', 'sample.sqlite');

    expect(preview.previewType).toBe('sqlite');
    expect(preview.supported).toBe(true);
  });

  it('rejects non-sqlite files that only carry a sqlite extension', async () => {
    const service = serviceWithRoot();

    const preview = await service.filePreview('codex', 'fake.db');

    expect(preview.supported).toBe(false);
    expect(preview.reason).toBe('不是有效的 SQLite 数据库文件');
  });

  it('lists tables and views with row counts', async () => {
    const service = serviceWithRoot();

    const overview = await service.sqliteOverview('codex', 'sample.sqlite');

    expect(overview.name).toBe('sample.sqlite');
    expect(overview.tables).toEqual([
      { name: 'logs', kind: 'table', rowCount: 1 },
      { name: 'users', kind: 'table', rowCount: 5 },
      { name: 'user_scores', kind: 'view', rowCount: 5 },
    ]);
  });

  it('pages rows with normalized cells and column metadata', async () => {
    const service = serviceWithRoot();

    const rows = await service.sqliteRows('codex', 'sample.sqlite', 'users', 1, 2);

    expect(rows.total).toBe(5);
    expect(rows.page).toBe(1);
    expect(rows.pageSize).toBe(2);
    expect(rows.columns.map(column => column.name)).toEqual(['id', 'name', 'score', 'avatar']);
    expect(rows.columns[0]?.pk).toBe(true);
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0]?.name).toBe('user-1');
    expect(String(rows.rows[0]?.avatar)).toContain('[BLOB 3 字节]');
  });

  it('returns the requested page beyond the first', async () => {
    const service = serviceWithRoot();

    const rows = await service.sqliteRows('codex', 'sample.sqlite', 'users', 3, 2);

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.name).toBe('user-5');
  });

  it('rejects table names that do not exist in the file', async () => {
    const service = serviceWithRoot();

    await expect(service.sqliteRows('codex', 'sample.sqlite', 'sqlite_master')).rejects.toThrow(BadRequestException);
    await expect(service.sqliteRows('codex', 'sample.sqlite', 'users; DROP TABLE users')).rejects.toThrow(BadRequestException);
  });

  it('rejects sqlite endpoints for files outside tool roots', async () => {
    const service = serviceWithRoot();

    await expect(service.sqliteOverview('codex', '../outside.sqlite')).rejects.toThrow();
    await expect(service.sqliteRows('codex', '../outside.sqlite', 'users')).rejects.toThrow();
  });

  it('rejects unknown tools for sqlite endpoints', async () => {
    const service = serviceWithRoot();

    await expect(service.sqliteOverview('claude', 'sample.sqlite')).rejects.toThrow(NotFoundException);
  });
});

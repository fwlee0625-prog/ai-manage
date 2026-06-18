import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { SessionDeleteBackup } from '../src/adapters/session-delete.js';
import type { SessionSummary } from '@ai-manage/shared';

describe('SessionDeleteBackup', () => {
  it('writes a trash manifest with removed jsonl rows', async () => {
    const dir = await mkdtemp(resolve(tmpdir(), 'ai-manage-delete-'));
    const sourcePath = resolve(dir, 'history.jsonl');
    await writeFile(sourcePath, '{"id":"keep"}\n{"id":"remove"}\n', 'utf8');

    const backup = new SessionDeleteBackup('codex', 'session-trash-test');
    await backup.rewriteJsonl(sourcePath, row => row.id === 'remove');
    const summary: SessionSummary = {
      id: 'session-trash-test',
      tool: 'codex',
      title: 'Trash Test',
      projectPath: '/tmp/project',
      sourcePath,
      messageCount: 1,
      preview: '',
    };
    const response = await backup.finalize(summary);

    const manifest = JSON.parse(await readFile(resolve(response.backupDir, 'manifest.json'), 'utf8'));
    expect(response.trashId).toBe(manifest.trashId);
    expect(manifest.files[0].operation).toBe('updated-jsonl');
    expect(manifest.files[0].removedLines).toEqual(['{"id":"remove"}']);
    expect(await readFile(sourcePath, 'utf8')).toBe('{"id":"keep"}\n');

    await rm(response.backupDir, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  });
});

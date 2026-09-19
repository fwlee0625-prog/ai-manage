import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ManageRepository } from '../src/database/manage.repository.js';

describe('ManageRepository', () => {
  it('applies managed-state migrations once', async () => {
    const dir = await mkdtemp(resolve(tmpdir(), 'ai-manage-managed-'));
    const repository = ManageRepository.forDatabase(resolve(dir, 'manage.sqlite'));
    await repository.init();
    await repository.init();
    expect(await repository.appliedMigrationVersions()).toEqual([1, 2, 3]);
    const tables = await repository.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    expect(tables.map(row => row.name)).toEqual(expect.arrayContaining(['providers', 'active_profiles', 'switch_history', 'managed_accounts', 'account_provider_bindings']));
  });
});

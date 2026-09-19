import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { CredentialStoreService } from '../src/credentials/credential-store.service.js';

describe('CredentialStoreService', () => {
  it('stores secrets internally and exposes only summaries', async () => {
    const dir = await mkdtemp(resolve(tmpdir(), 'ai-manage-credentials-'));
    const service = CredentialStoreService.forFile(resolve(dir, 'api-keys.json'));
    const summary = await service.createApiKey('sk-phase-one-secret');
    expect(summary.configured).toBe(true);
    expect(summary).not.toHaveProperty('value');
    expect(await service.readApiKey(summary.id)).toBe('sk-phase-one-secret');
    await service.replaceApiKey(summary.id, 'sk-replaced-secret');
    expect(await service.readApiKey(summary.id)).toBe('sk-replaced-secret');
    await service.deleteCredential(summary.id);
    expect(await service.hasCredential(summary.id)).toBe(false);
  });
});

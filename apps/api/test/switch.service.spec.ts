import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { CredentialStoreService } from '../src/credentials/credential-store.service.js';
import { ManageRepository } from '../src/database/manage.repository.js';
import { PathGuard } from '../src/fs/path-guard.js';
import { ProvidersRepository } from '../src/providers/providers.repository.js';
import { ProvidersService } from '../src/providers/providers.service.js';
import { LiveFileWriterService } from '../src/runtime/live-file-writer.service.js';
import { RuntimeDetectorService } from '../src/runtime/runtime-detector.service.js';
import { RuntimeRepository } from '../src/runtime/runtime.repository.js';
import { SnapshotService } from '../src/runtime/snapshot.service.js';
import { SwitchService } from '../src/runtime/switch.service.js';

describe('SwitchService', () => {
  it('switches Codex through projection and preserves unrelated config', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'ai-manage-switch-'));
    const codexRoot = resolve(root, '.codex');
    const claudeRoot = resolve(root, '.claude');
    await mkdir(codexRoot, { recursive: true });
    await mkdir(claudeRoot, { recursive: true });
    await writeFile(resolve(codexRoot, 'config.toml'), 'notify = ["keep"]\n[projects."/tmp/demo"]\ntrust_level = "trusted"\n', 'utf8');
    await writeFile(resolve(codexRoot, 'auth.json'), '{"tokens":{"keep":true}}\n', 'utf8');

    const manage = ManageRepository.forDatabase(resolve(root, 'manage.sqlite'));
    await manage.init();
    const credentials = CredentialStoreService.forFile(resolve(root, 'credentials.json'));
    const providersRepo = new ProvidersRepository(manage);
    const providers = new ProvidersService(providersRepo, credentials);
    const target = await providers.create({ tool: 'codex', name: 'Target', providerType: 'custom', endpoint: 'https://example.test', apiProtocol: 'responses', defaultModel: 'gpt-x', apiKey: 'secret' });
    const writer = new LiveFileWriterService(PathGuard.forRoots(codexRoot, claudeRoot));
    const runtimeRepo = new RuntimeRepository(manage);
    const detector = new RuntimeDetectorService(writer, providersRepo, runtimeRepo);
    const service = new SwitchService(providersRepo, credentials, writer, new SnapshotService(writer), detector, runtimeRepo);

    const result = await service.switchProvider({ tool: 'codex', providerId: target.id });

    expect(result.success).toBe(true);
    const raw = await readFile(resolve(codexRoot, 'config.toml'), 'utf8');
    expect(raw).toContain('notify = ["keep"]');
    expect(raw).toContain('[projects."/tmp/demo"]');
    expect(await runtimeRepo.active('codex')).toMatchObject({ providerId: target.id });
    expect(JSON.parse(await readFile(resolve(codexRoot, 'auth.json'), 'utf8')).tokens).toEqual({ keep: true });
  });
});

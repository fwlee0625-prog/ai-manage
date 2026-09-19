import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { AccountsRepository } from '../src/accounts/accounts.repository.js';
import { CredentialStoreService } from '../src/credentials/credential-store.service.js';
import { ManageRepository } from '../src/database/manage.repository.js';
import { extractClaudeProviderCandidate, extractCodexProviderCandidates } from '../src/providers/provider-import.service.js';
import { ProvidersRepository } from '../src/providers/providers.repository.js';
import { ProvidersService } from '../src/providers/providers.service.js';

describe('Providers domain', () => {
  async function createService() {
    const dir = await mkdtemp(resolve(tmpdir(), 'ai-manage-providers-'));
    const manage = ManageRepository.forDatabase(resolve(dir, 'manage.sqlite'));
    await manage.init();
    const credentials = CredentialStoreService.forFile(resolve(dir, 'credentials', 'api-keys.json'));
    return { service: new ProvidersService(new ProvidersRepository(manage), credentials, new AccountsRepository(manage)), credentials };
  }

  it('creates preset providers without returning API keys', async () => {
    const { service, credentials } = await createService();
    const provider = await service.create({ tool: 'codex', presetId: 'openrouter', name: 'My OpenRouter', apiKey: 'sk-not-in-dto' });
    expect(provider.providerType).toBe('openrouter');
    expect(provider.credential?.configured).toBe(true);
    expect(JSON.stringify(provider)).not.toContain('sk-not-in-dto');
    expect(await credentials.readApiKey(provider.credentialId!)).toBe('sk-not-in-dto');
  });

  it('lists expected presets', async () => {
    const { service } = await createService();
    expect(service.presets('codex').map(item => item.id)).toContain('openai-official');
    expect(service.presets('claude').map(item => item.id)).toContain('claude-official');
  });

  it('extracts Codex and Claude live provider candidates', () => {
    expect(extractCodexProviderCandidates({ model_provider: 'openrouter', model: 'gpt-test', model_reasoning_effort: 'high', model_providers: { openrouter: { name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', wire_api: 'responses' } } })[0]).toMatchObject({ sourceKey: 'openrouter', defaultModel: 'gpt-test', reasoningEffort: 'high' });
    expect(extractClaudeProviderCandidate({ env: { ANTHROPIC_BASE_URL: 'https://example.test', ANTHROPIC_API_KEY: 'secret', ANTHROPIC_MODEL: 'claude-test' } })).toMatchObject({ tool: 'claude', authMode: 'api_key', defaultModel: 'claude-test', apiKey: 'secret' });
  });
});

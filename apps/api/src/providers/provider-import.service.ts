import { Injectable } from '@nestjs/common';
import type { AiProviderProfile, AiTool, CreateProviderRequest, ImportProvidersResponse } from '@ai-manage/shared';
import { ConfigsService } from '../routes/configs.service.js';
import { CODEX_OFFICIAL_LIVE_KEY, codexLiveProviderKey } from '../projections/projection.types.js';
import { ProvidersService } from './providers.service.js';

interface ImportCandidate extends CreateProviderRequest { sourceKey: string; }

/**
 * Extracts Codex provider candidates from parsed config.
 *
 * A Codex install that only talks to OpenAI keeps `model_provider` / `model_providers`
 * out of config.toml entirely. That native login state is still a legal runtime, so it is
 * surfaced as one OpenAI Official candidate instead of importing nothing.
 */
export function extractCodexProviderCandidates(parsed: unknown): ImportCandidate[] {
  if (!isRecord(parsed)) return [];
  const providers = isRecord(parsed.model_providers) ? parsed.model_providers : {};
  const activeKey = scalar(parsed.model_provider) || CODEX_OFFICIAL_LIVE_KEY;
  const model = scalar(parsed.model);
  const reasoning = scalar(parsed.model_reasoning_effort);
  const candidates = Object.entries(providers).map(([key, raw]) => {
    const value = isRecord(raw) ? raw : {};
    return {
      sourceKey: key, tool: 'codex' as const, name: scalar(value.name) || key, providerType: key,
      endpoint: scalar(value.base_url || value.baseUrl), apiProtocol: scalar(value.wire_api || value.wireApi),
      defaultModel: key === activeKey ? model : undefined, reasoningEffort: key === activeKey ? reasoning : undefined,
      authMode: key === CODEX_OFFICIAL_LIVE_KEY ? 'native_login' as const : 'api_key' as const,
      metadata: { importSource: 'codex-live', importSourceKey: key },
    };
  });
  if (activeKey !== CODEX_OFFICIAL_LIVE_KEY || candidates.some(item => item.sourceKey === CODEX_OFFICIAL_LIVE_KEY)) {
    return candidates;
  }
  return [
    ...candidates,
    {
      // The official entry intentionally keeps endpoint/protocol empty so adopting it never
      // rewrites the tool's own OpenAI defaults into config.toml.
      sourceKey: CODEX_OFFICIAL_LIVE_KEY, tool: 'codex', name: 'OpenAI Official',
      providerType: CODEX_OFFICIAL_LIVE_KEY, endpoint: '', apiProtocol: '',
      defaultModel: model, reasoningEffort: reasoning, authMode: 'native_login',
      metadata: { importSource: 'codex-live', importSourceKey: CODEX_OFFICIAL_LIVE_KEY, official: true },
    },
  ];
}

/** Extracts Claude's env-backed provider candidate. */
export function extractClaudeProviderCandidate(parsed: unknown): ImportCandidate | undefined {
  if (!isRecord(parsed) || !isRecord(parsed.env)) return undefined;
  const env = parsed.env;
  const endpoint = scalar(env.ANTHROPIC_BASE_URL);
  const model = scalar(env.ANTHROPIC_MODEL || env.ANTHROPIC_DEFAULT_SONNET_MODEL || env.ANTHROPIC_DEFAULT_OPUS_MODEL || env.ANTHROPIC_DEFAULT_HAIKU_MODEL);
  const apiKey = scalar(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
  if (!endpoint && !model && !apiKey) return undefined;
  return {
    sourceKey: 'claude-env', tool: 'claude', name: endpoint ? 'Claude Custom' : 'Claude Official',
    providerType: endpoint ? 'anthropic-compatible' : 'anthropic', endpoint, apiProtocol: 'anthropic',
    defaultModel: model, authMode: apiKey ? 'api_key' : 'native_login', apiKey: apiKey || undefined,
    metadata: { importSource: 'claude-live', importSourceKey: 'claude-env' },
  };
}

@Injectable()
export class ProviderImportService {
  constructor(private readonly configs: ConfigsService, private readonly providers: ProvidersService) {}

  /** Imports live provider state into managed state without writing live files. */
  async importLive(tool: AiTool): Promise<ImportProvidersResponse> {
    const details = await this.configs.editableConfigDetails(tool);
    const existing = await this.providers.list(tool);
    const seen = new Set(existing.map(item => importIdentity(item)).filter(Boolean));
    let candidates: ImportCandidate[] = [];
    if (tool === 'codex') {
      const config = details.find(item => item.name === 'config.toml');
      const parsed = config?.formModel ?? config?.parsed;
      candidates = extractCodexProviderCandidates(parsed);
      const activeKey = codexLiveProviderKey(isRecord(parsed) ? parsed.model_provider : undefined);
      if (activeKey !== CODEX_OFFICIAL_LIVE_KEY) {
        const key = await this.configs.codexOpenAiApiKey();
        if (key.exists && key.openaiApiKey) candidates = candidates.map(item => item.sourceKey === activeKey ? { ...item, apiKey: key.openaiApiKey } : item);
      }
    } else {
      const settings = details.find(item => item.name === 'settings.json') || details.find(item => item.name === 'settings.local.json');
      const candidate = extractClaudeProviderCandidate(settings?.formModel ?? settings?.parsed);
      candidates = candidate ? [candidate] : [];
    }
    const imported: AiProviderProfile[] = [];
    let skipped = 0;
    for (const candidate of candidates) {
      const identity = `${tool}:${candidate.sourceKey}`;
      if (seen.has(identity)) { skipped += 1; continue; }
      imported.push(await this.providers.create(candidate));
      seen.add(identity);
    }
    return { imported, skipped };
  }
}
function importIdentity(provider: AiProviderProfile): string {
  const sourceKey = provider.metadata.importSourceKey;
  return typeof sourceKey === 'string' ? `${provider.tool}:${sourceKey}` : '';
}
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function scalar(value: unknown): string { return typeof value === 'string' ? value.trim() : typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''; }

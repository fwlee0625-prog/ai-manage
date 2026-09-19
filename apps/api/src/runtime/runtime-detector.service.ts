import { Injectable } from '@nestjs/common';
import type { AiProviderProfile, AiTool, RuntimeSummary } from '@ai-manage/shared';
import { providerLiveKey } from '../projections/projection.types.js';
import { ProvidersRepository } from '../providers/providers.repository.js';
import { LiveFileWriterService } from './live-file-writer.service.js';
import { RuntimeRepository } from './runtime.repository.js';

@Injectable()
export class RuntimeDetectorService {
  constructor(
    private readonly writer: LiveFileWriterService,
    private readonly providers: ProvidersRepository,
    private readonly runtime: RuntimeRepository,
  ) {}

  /** Returns managed/live runtime alignment for one tool. */
  async summary(tool: AiTool): Promise<RuntimeSummary> {
    const [live, providers, active] = await Promise.all([
      this.writer.readLive(tool),
      this.providers.list(tool),
      this.runtime.active(tool),
    ]);
    const actual = providers.find(provider => this.matchesLive(tool, provider, live.config));
    return {
      tool,
      managedProviderId: active?.providerId,
      actualProviderMatchId: actual?.id,
      syncStatus: active && actual?.id === active.providerId ? 'synced' : 'unmanaged',
      model: liveModel(tool, live.config),
      providerName: actual?.name,
      reasoningEffort: tool === 'codex' ? scalar(live.config.model_reasoning_effort) : undefined,
      authMode: actual?.authMode,
      lastSwitchedAt: active?.switchedAt,
    };
  }

  /** Verifies that current live state matches one target provider. */
  async matchesProvider(provider: AiProviderProfile): Promise<boolean> {
    const live = await this.writer.readLive(provider.tool);
    return this.matchesLive(provider.tool, provider, live.config);
  }

  private matchesLive(tool: AiTool, provider: AiProviderProfile, config: Record<string, unknown>): boolean {
    if (tool === 'codex') {
      const liveKey = scalar(config.model_provider);
      if (liveKey !== providerLiveKey(provider)) return false;
      if (provider.defaultModel && scalar(config.model) !== provider.defaultModel) return false;
      const providers = isRecord(config.model_providers) ? config.model_providers : {};
      const item = isRecord(providers[liveKey]) ? providers[liveKey] as Record<string, unknown> : {};
      if (provider.endpoint && scalar(item.base_url || item.baseUrl) !== provider.endpoint) return false;
      return true;
    }
    const env = isRecord(config.env) ? config.env : {};
    if (provider.endpoint && provider.authMode !== 'native_login' && scalar(env.ANTHROPIC_BASE_URL) !== provider.endpoint) return false;
    if (provider.authMode === 'native_login' && scalar(env.ANTHROPIC_BASE_URL)) return false;
    if (provider.defaultModel && scalar(env.ANTHROPIC_MODEL) !== provider.defaultModel) return false;
    return true;
  }
}

function liveModel(tool: AiTool, config: Record<string, unknown>): string | undefined {
  if (tool === 'codex') return scalar(config.model) || undefined;
  const env = isRecord(config.env) ? config.env : {};
  return scalar(env.ANTHROPIC_MODEL) || undefined;
}
function scalar(value: unknown): string { return typeof value === 'string' ? value : ''; }
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }

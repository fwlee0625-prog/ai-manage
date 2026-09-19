import { Injectable } from '@nestjs/common';
import type { AiProviderProfile, AiTool, RuntimeSummary, RuntimeSyncStatus } from '@ai-manage/shared';
import { AccountsRepository } from '../accounts/accounts.repository.js';
import { providerLiveKey } from '../projections/projection.types.js';
import { ProvidersRepository } from '../providers/providers.repository.js';
import { LiveFileWriterService, type RuntimeLiveState } from './live-file-writer.service.js';
import { RuntimeRepository } from './runtime.repository.js';

@Injectable()
export class RuntimeDetectorService {
  constructor(
    private readonly writer: LiveFileWriterService,
    private readonly providers: ProvidersRepository,
    private readonly runtime: RuntimeRepository,
    private readonly accounts: AccountsRepository,
  ) {}

  /** Returns managed/live runtime alignment across provider, model, endpoint and auth identity. */
  async summary(tool: AiTool): Promise<RuntimeSummary> {
    const [live, providers, active] = await Promise.all([
      this.writer.readLive(tool),
      this.providers.list(tool),
      this.runtime.active(tool),
    ]);
    const actual = providers.find(provider => this.matchesLive(tool, provider, live));
    const managed = active ? providers.find(provider => provider.id === active.providerId) : undefined;
    const status = await this.syncStatus(tool, managed, actual, live);
    const accountSummary = await this.accountSummary(managed, live);

    return {
      tool,
      managedProviderId: active?.providerId,
      actualProviderMatchId: actual?.id,
      syncStatus: status,
      model: liveModel(tool, live.config),
      providerName: actual?.name || managed?.name,
      reasoningEffort: tool === 'codex' ? scalar(live.config.model_reasoning_effort) || undefined : undefined,
      authMode: actual?.authMode || managed?.authMode || liveAuthMode(tool, live),
      accountSummary,
      lastSwitchedAt: active?.switchedAt,
    };
  }

  /** Verifies that current live state matches one target provider including its auth mode. */
  async matchesProvider(provider: AiProviderProfile): Promise<boolean> {
    const live = await this.writer.readLive(provider.tool);
    if (!this.matchesLive(provider.tool, provider, live)) return false;
    const authState = await this.providerAuthStatus(provider, live);
    return authState !== 'auth_invalid' && authState !== 'reauth_required';
  }

  private async syncStatus(
    tool: AiTool,
    managed: AiProviderProfile | undefined,
    actual: AiProviderProfile | undefined,
    live: RuntimeLiveState,
  ): Promise<RuntimeSyncStatus> {
    const authTarget = actual || managed;
    if (authTarget) {
      const authStatus = await this.providerAuthStatus(authTarget, live);
      if (authStatus) return authStatus;
    }
    if (!managed) return 'unmanaged';
    if (!actual || actual.id !== managed.id || !this.matchesLive(tool, managed, live)) return 'externally_modified';
    return 'synced';
  }

  private async providerAuthStatus(
    provider: AiProviderProfile,
    live: RuntimeLiveState,
  ): Promise<'auth_invalid' | 'reauth_required' | undefined> {
    if (provider.authMode === 'managed_account') {
      if (!provider.accountId) return 'auth_invalid';
      const account = await this.accounts.get(provider.accountId);
      if (!account || account.status === 'invalid') return 'auth_invalid';
      if (account.status === 'reauth_required') return 'reauth_required';
      if (provider.tool === 'codex') {
        const liveIdentity = codexLiveIdentity(live.auth);
        if (
          account.externalAccountId
          && liveIdentity.externalAccountId
          && account.externalAccountId !== liveIdentity.externalAccountId
        ) return 'auth_invalid';
        if (
          account.identitySubject
          && liveIdentity.identitySubject
          && account.identitySubject !== liveIdentity.identitySubject
        ) return 'auth_invalid';
      }
      return undefined;
    }

    if (provider.authMode === 'api_key') {
      if (provider.tool === 'codex') {
        return scalar(live.auth?.OPENAI_API_KEY) ? undefined : 'auth_invalid';
      }
      const env = isRecord(live.config.env) ? live.config.env : {};
      return scalar(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) ? undefined : 'auth_invalid';
    }
    return undefined;
  }

  private async accountSummary(
    provider: AiProviderProfile | undefined,
    live: RuntimeLiveState,
  ): Promise<string | undefined> {
    if (provider?.authMode === 'managed_account' && provider.accountId) {
      const account = await this.accounts.get(provider.accountId);
      if (account) return account.email || account.displayName || account.externalAccountId || account.id;
    }
    if (provider?.tool === 'codex') {
      const identity = codexLiveIdentity(live.auth);
      return identity.email || identity.externalAccountId;
    }
    return undefined;
  }

  private matchesLive(tool: AiTool, provider: AiProviderProfile, live: RuntimeLiveState): boolean {
    const config = live.config;
    if (tool === 'codex') {
      const liveKey = scalar(config.model_provider);
      if (liveKey !== providerLiveKey(provider)) return false;
      if (provider.defaultModel && scalar(config.model) !== provider.defaultModel) return false;
      if (provider.reasoningEffort && scalar(config.model_reasoning_effort) !== provider.reasoningEffort) return false;
      const providers = isRecord(config.model_providers) ? config.model_providers : {};
      const item = isRecord(providers[liveKey]) ? providers[liveKey] as Record<string, unknown> : {};
      if (provider.endpoint && scalar(item.base_url || item.baseUrl) !== provider.endpoint) return false;
      if (provider.apiProtocol && scalar(item.wire_api || item.wireApi) !== provider.apiProtocol) return false;
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

function liveAuthMode(tool: AiTool, live: RuntimeLiveState): string | undefined {
  if (tool === 'codex') {
    if (scalar(live.auth?.OPENAI_API_KEY)) return 'api_key';
    if (scalar(live.auth?.auth_mode) === 'chatgpt' || isRecord(live.auth?.tokens)) return 'native_login';
    return undefined;
  }
  const env = isRecord(live.config.env) ? live.config.env : {};
  if (scalar(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN)) return 'api_key';
  return 'native_login';
}

function codexLiveIdentity(auth?: Record<string, unknown>): {
  email?: string;
  identitySubject?: string;
  externalAccountId?: string;
} {
  const tokens = isRecord(auth?.tokens) ? auth.tokens : {};
  const idToken = isRecord(tokens.id_token) ? tokens.id_token : {};
  return {
    email: scalar(idToken.email) || undefined,
    identitySubject: scalar(idToken.chatgpt_user_id) || undefined,
    externalAccountId: scalar(tokens.account_id || idToken.chatgpt_account_id) || undefined,
  };
}

function scalar(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }

import { BadRequestException } from '@nestjs/common';
import { codexIdTokenInfo } from '../accounts/oauth/codex-oauth.service.js';
import { cloneRecord, providerLiveKey, type ProjectionInput, type ProjectionResult } from './projection.types.js';

/** Projects one managed provider into Codex owned fields while preserving unrelated config. */
export function buildCodexProjection(input: ProjectionInput): ProjectionResult {
  const config = cloneRecord(input.currentConfig);
  const providerKey = providerLiveKey(input.provider);
  const providers = isRecord(config.model_providers) ? cloneRecord(config.model_providers) : {};
  const currentProvider = isRecord(providers[providerKey]) ? cloneRecord(providers[providerKey] as Record<string, unknown>) : {};
  const projectedProvider: Record<string, unknown> = {
    ...currentProvider,
    name: input.provider.name,
    ...(input.provider.endpoint ? { base_url: input.provider.endpoint } : {}),
    ...(input.provider.apiProtocol ? { wire_api: input.provider.apiProtocol } : {}),
  };
  if (input.provider.authMode === 'api_key') projectedProvider.env_key = 'OPENAI_API_KEY';
  else delete projectedProvider.env_key;
  providers[providerKey] = projectedProvider;

  config.model_provider = providerKey;
  config.model_providers = providers;
  assignOrDelete(config, 'model', input.provider.defaultModel);
  assignOrDelete(config, 'model_reasoning_effort', input.provider.reasoningEffort);

  if (input.provider.authMode === 'managed_account') {
    if (!input.account) throw new BadRequestException('Managed account authentication is not available');
    const auth = cloneRecord(input.currentAuth);
    delete auth.OPENAI_API_KEY;
    auth.auth_mode = 'chatgpt';
    auth.tokens = {
      id_token: codexIdTokenInfo(input.account.idToken),
      access_token: input.account.accessToken,
      refresh_token: input.account.refreshToken,
      account_id: input.account.identity.externalAccountId,
    };
    auth.last_refresh = new Date().toISOString();
    return { config, auth, authTouched: true, warnings: [] };
  }

  if (input.provider.authMode !== 'api_key') {
    return { config, auth: cloneRecord(input.currentAuth), authTouched: false, warnings: [] };
  }
  if (!input.credential) throw new BadRequestException('Provider API key credential is not configured');
  const auth = cloneRecord(input.currentAuth);
  auth.OPENAI_API_KEY = input.credential;
  return { config, auth, authTouched: true, warnings: [] };
}

function assignOrDelete(record: Record<string, unknown>, key: string, value?: string): void {
  if (value?.trim()) record[key] = value.trim();
  else delete record[key];
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

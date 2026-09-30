import type { AiProviderProfile } from '@ai-manage/shared';

export interface ManagedAccountAuthBundle {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  identity: {
    email?: string;
    identitySubject?: string;
    externalAccountId?: string;
    planType?: string;
    isFedramp: boolean;
  };
}

export interface ProjectionInput {
  provider: AiProviderProfile;
  credential?: string;
  account?: ManagedAccountAuthBundle;
  currentConfig: Record<string, unknown>;
  currentAuth?: Record<string, unknown>;
}

export interface ProjectionResult {
  config: Record<string, unknown>;
  auth?: Record<string, unknown>;
  authTouched: boolean;
  warnings: string[];
}

/** Codex's implicit built-in provider key used when config.toml declares no `model_provider`. */
export const CODEX_OFFICIAL_LIVE_KEY = 'openai';

/** Returns the stable live provider key used in Codex config. */
export function providerLiveKey(provider: AiProviderProfile): string {
  const source = provider.metadata.importSourceKey;
  const liveKey = provider.metadata.liveKey;
  if (typeof source === 'string' && source.trim()) return source.trim();
  if (typeof liveKey === 'string' && liveKey.trim()) return liveKey.trim();
  return provider.providerType;
}

/** Returns the live provider key Codex is currently resolving, including its implicit default. */
export function codexLiveProviderKey(modelProvider: unknown): string {
  const key = typeof modelProvider === 'string' ? modelProvider.trim() : '';
  return key || CODEX_OFFICIAL_LIVE_KEY;
}

/** Creates a JSON-compatible clone for projection inputs. */
export function cloneRecord(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return value ? JSON.parse(JSON.stringify(value)) as Record<string, unknown> : {};
}

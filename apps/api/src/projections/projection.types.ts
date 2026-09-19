import type { AiProviderProfile } from '@ai-manage/shared';

export interface ProjectionInput {
  provider: AiProviderProfile;
  credential?: string;
  currentConfig: Record<string, unknown>;
  currentAuth?: Record<string, unknown>;
}

export interface ProjectionResult {
  config: Record<string, unknown>;
  auth?: Record<string, unknown>;
  authTouched: boolean;
  warnings: string[];
}

/** Returns the stable live provider key used in Codex config. */
export function providerLiveKey(provider: AiProviderProfile): string {
  const source = provider.metadata.importSourceKey;
  const liveKey = provider.metadata.liveKey;
  if (typeof source === 'string' && source.trim()) return source.trim();
  if (typeof liveKey === 'string' && liveKey.trim()) return liveKey.trim();
  return provider.providerType;
}

/** Creates a JSON-compatible clone for projection inputs. */
export function cloneRecord(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return value ? JSON.parse(JSON.stringify(value)) as Record<string, unknown> : {};
}

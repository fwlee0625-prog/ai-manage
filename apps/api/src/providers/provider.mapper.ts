import type { AiProviderProfile, ProviderAuthMode } from '@ai-manage/shared';

export interface ProviderRow {
  id: string; tool: AiProviderProfile['tool']; name: string; provider_type: string;
  endpoint?: string | null; api_protocol?: string | null; default_model?: string | null;
  reasoning_effort?: string | null; auth_mode: ProviderAuthMode; account_id?: string | null;
  credential_id?: string | null; sort_index?: number | null; metadata_json: string; created_at: string; updated_at: string;
}

/** Maps a managed-state row to a public provider profile. */
export function providerFromRow(row: ProviderRow): AiProviderProfile {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.metadata_json) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
  } catch { metadata = {}; }
  return {
    id: row.id, tool: row.tool, name: row.name, providerType: row.provider_type,
    endpoint: row.endpoint || undefined, apiProtocol: row.api_protocol || undefined,
    defaultModel: row.default_model || undefined, reasoningEffort: row.reasoning_effort || undefined,
    authMode: row.auth_mode, accountId: row.account_id || undefined, credentialId: row.credential_id || undefined,
    sortIndex: Number(row.sort_index ?? 0), metadata, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

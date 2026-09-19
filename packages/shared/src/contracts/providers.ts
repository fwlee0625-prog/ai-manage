import type { AiTool } from './common.js';
import type { ProviderCredentialSummary } from './credentials.js';

export type ProviderAuthMode = 'native_login' | 'managed_account' | 'api_key' | 'none';

export interface AiProviderProfile {
  id: string;
  tool: AiTool;
  name: string;
  providerType: string;
  endpoint?: string;
  apiProtocol?: string;
  defaultModel?: string;
  reasoningEffort?: string;
  authMode: ProviderAuthMode;
  accountId?: string;
  credentialId?: string;
  credential?: ProviderCredentialSummary;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderPreset {
  id: string;
  tool: AiTool;
  name: string;
  providerType: string;
  endpoint?: string;
  apiProtocol?: string;
  authMode: ProviderAuthMode;
  defaultModel?: string;
  metadata: Record<string, unknown>;
}

export interface CreateProviderRequest {
  presetId?: string;
  tool?: AiTool;
  name?: string;
  providerType?: string;
  endpoint?: string;
  apiProtocol?: string;
  defaultModel?: string;
  reasoningEffort?: string;
  authMode?: ProviderAuthMode;
  accountId?: string;
  credentialId?: string;
  apiKey?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateProviderRequest {
  name?: string;
  providerType?: string;
  endpoint?: string | null;
  apiProtocol?: string | null;
  defaultModel?: string | null;
  reasoningEffort?: string | null;
  authMode?: ProviderAuthMode;
  accountId?: string | null;
  credentialId?: string | null;
  apiKey?: string;
  removeCredential?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ImportProvidersRequest { tool: AiTool; }
export interface ImportProvidersResponse { imported: AiProviderProfile[]; skipped: number; }

export interface ProviderTestResponse {
  ok: boolean;
  stage: 'validate' | 'connect';
  status?: number;
  message: string;
}

export interface ProviderModelsResponse {
  models: string[];
}

export interface ProviderDraftModelsRequest extends CreateProviderRequest {
  tool: AiTool;
}

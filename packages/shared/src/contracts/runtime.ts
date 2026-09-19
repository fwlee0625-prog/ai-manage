import type { AiTool } from './common.js';

export type RuntimeSyncStatus = 'synced' | 'externally_modified' | 'unmanaged' | 'auth_invalid' | 'reauth_required';

export interface RuntimeSummary {
  tool: AiTool;
  managedProviderId?: string;
  actualProviderMatchId?: string;
  syncStatus: RuntimeSyncStatus;
  model?: string;
  providerName?: string;
  reasoningEffort?: string;
  authMode?: string;
  accountSummary?: string;
  lastSwitchedAt?: string;
}

export interface SwitchProviderRequest { tool: AiTool; providerId: string; }
export interface SwitchProviderResponse {
  success: boolean;
  tool: AiTool;
  providerId: string;
  stage?: string;
  rolledBack?: boolean;
  warnings?: string[];
  runtime?: RuntimeSummary;
}

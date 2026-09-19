import type { AiProviderProfile, AiTool, ProviderAuthMode } from '@ai-manage/shared';

export interface ProviderDraft {
  id?: string;
  tool: AiTool;
  presetId?: string;
  name: string;
  providerType: string;
  endpoint: string;
  apiProtocol: string;
  defaultModel: string;
  reasoningEffort: string;
  authMode: ProviderAuthMode;
  apiKey: string;
  credentialConfigured: boolean;
  removeCredential: boolean;
}

/** Creates an empty provider form for one selected tool. */
export function emptyProviderDraft(tool: AiTool): ProviderDraft {
  return {
    tool, name: '', providerType: '', endpoint: '', apiProtocol: '',
    defaultModel: '', reasoningEffort: 'medium', authMode: 'api_key',
    apiKey: '', credentialConfigured: false, removeCredential: false,
  };
}

/** Converts a safe provider DTO to an edit form without requesting the secret. */
export function providerToDraft(provider: AiProviderProfile): ProviderDraft {
  return {
    id: provider.id, tool: provider.tool, name: provider.name, providerType: provider.providerType,
    endpoint: provider.endpoint || '', apiProtocol: provider.apiProtocol || '',
    defaultModel: provider.defaultModel || '', reasoningEffort: provider.reasoningEffort || 'medium',
    authMode: provider.authMode, apiKey: '', credentialConfigured: !!provider.credential?.configured,
    removeCredential: false,
  };
}

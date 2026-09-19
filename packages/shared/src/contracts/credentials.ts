export type CredentialKind = 'api_key' | 'oauth';
export interface ProviderCredentialSummary {
  id: string;
  kind: CredentialKind;
  configured: boolean;
}

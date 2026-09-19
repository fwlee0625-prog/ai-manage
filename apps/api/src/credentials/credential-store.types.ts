export interface StoredApiKeyCredential {
  id: string;
  kind: 'api_key';
  value: string;
  createdAt: string;
  updatedAt: string;
}
export interface ApiKeyCredentialFile {
  version: 1;
  credentials: Record<string, StoredApiKeyCredential>;
}

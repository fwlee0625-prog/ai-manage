export type AccountStatus = 'active' | 'reauth_required' | 'invalid';

export interface ManagedAccount {
  id: string;
  authProvider: 'codex_oauth';
  displayName?: string;
  email?: string;
  externalAccountId?: string;
  identitySubject?: string;
  authenticatedAt?: string;
  tokenUpdatedAt?: string;
  status: AccountStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ManagedAccountSummary = ManagedAccount;

export interface StartDeviceLoginResponse {
  loginId: string;
  verificationUrl: string;
  userCode: string;
  intervalSeconds: number;
  expiresAt: string;
}

export interface PollDeviceLoginResponse {
  status: 'pending' | 'complete' | 'expired';
  account?: ManagedAccountSummary;
}

export interface ReauthAccountRequest {
  accountId: string;
}

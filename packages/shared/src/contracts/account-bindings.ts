export type AccountBindingPurpose =
  | 'default'
  | 'fallback'
  | 'authentication';

export interface AccountBinding {
  id: string;
  providerId: string;
  accountId: string;
  purpose: AccountBindingPurpose;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

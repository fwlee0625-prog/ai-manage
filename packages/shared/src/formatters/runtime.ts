import type { ProviderAuthMode } from '../contracts/providers.js';
import type { RuntimeSyncStatus } from '../contracts/runtime.js';

const SYNC_STATUS_LABELS: Record<RuntimeSyncStatus, string> = {
  synced: '已同步',
  externally_modified: '检测到外部修改',
  unmanaged: '未托管',
  auth_invalid: '认证无效',
  reauth_required: '需要重新认证',
};

const AUTH_MODE_LABELS: Record<ProviderAuthMode, string> = {
  api_key: 'API Key',
  native_login: '跟随原生登录',
  managed_account: '托管账号',
  none: '无认证',
};

/**
 * Returns the localized label for one runtime synchronization status.
 *
 * Shared by the PC and mobile runtimes so the raw contract enum never reaches the UI.
 */
export function runtimeSyncStatusLabel(status?: RuntimeSyncStatus): string {
  return status ? SYNC_STATUS_LABELS[status] || '未托管' : '未托管';
}

/**
 * Returns the localized label for one provider authentication mode.
 *
 * Unknown values fall back to the raw value so a future backend mode is never hidden.
 */
export function runtimeAuthModeLabel(authMode?: ProviderAuthMode | string): string {
  if (!authMode) return '认证未知';
  return AUTH_MODE_LABELS[authMode as ProviderAuthMode] || String(authMode);
}

/**
 * Formats an ISO timestamp as local `YYYY/MM/DD HH:mm:ss`.
 *
 * Returns an empty string for missing or invalid values so callers can skip the row.
 */
export function formatRuntimeTimestamp(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

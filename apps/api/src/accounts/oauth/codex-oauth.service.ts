import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { StartDeviceLoginResponse } from '@ai-manage/shared';
import { CodexOAuthStoreService } from './codex-oauth-store.service.js';

const DEFAULT_ISSUER = 'https://auth.openai.com';
const DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const DEVICE_LOGIN_TTL_MS = 15 * 60 * 1000;

interface PendingDeviceLogin {
  loginId: string;
  deviceAuthId: string;
  userCode: string;
  intervalSeconds: number;
  expiresAtMs: number;
  existingAccountId?: string;
}

interface TokenResponse {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
}

interface DevicePollSuccess {
  authorization_code: string;
  code_verifier: string;
  code_challenge: string;
}

export interface CodexOAuthIdentity {
  email?: string;
  identitySubject?: string;
  externalAccountId?: string;
  planType?: string;
  isFedramp: boolean;
}

export interface CodexOAuthTokenBundle {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  identity: CodexOAuthIdentity;
}

export interface OAuthPollResult {
  status: 'pending' | 'complete' | 'expired';
  existingAccountId?: string;
  bundle?: CodexOAuthTokenBundle;
}

@Injectable()
export class CodexOAuthService {
  private readonly pending = new Map<string, PendingDeviceLogin>();
  private readonly accessCache = new Map<string, { token: string; expiresAtMs: number }>();
  private readonly refreshLocks = new Map<string, Promise<CodexOAuthTokenBundle>>();
  private fetchImpl: typeof fetch = fetch;
  private readonly issuer = (process.env.CODEX_AUTH_ISSUER || DEFAULT_ISSUER).replace(/\/$/, '');
  private readonly clientId = process.env.CODEX_APP_SERVER_LOGIN_CLIENT_ID || DEFAULT_CLIENT_ID;

  constructor(private readonly store: CodexOAuthStoreService) {}

  static forTesting(store: CodexOAuthStoreService, fetchImpl: typeof fetch): CodexOAuthService {
    const service = new CodexOAuthService(store);
    service.fetchImpl = fetchImpl;
    return service;
  }

  /** Starts Codex-compatible ChatGPT device authorization. */
  async startDeviceLogin(existingAccountId?: string): Promise<StartDeviceLoginResponse> {
    const response = await this.fetchImpl(`${this.issuer}/api/accounts/deviceauth/usercode`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: this.clientId }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new BadRequestException(`Device login start failed with HTTP ${response.status}`);
    const body = await response.json() as { device_auth_id?: string; user_code?: string; usercode?: string; interval?: string | number };
    const deviceAuthId = body.device_auth_id?.trim();
    const userCode = (body.user_code || body.usercode)?.trim();
    if (!deviceAuthId || !userCode) throw new BadRequestException('Device login response is invalid');
    const intervalSeconds = Math.max(1, Number(body.interval) || 5);
    const loginId = randomUUID();
    const expiresAtMs = Date.now() + DEVICE_LOGIN_TTL_MS;
    this.pending.set(loginId, { loginId, deviceAuthId, userCode, intervalSeconds, expiresAtMs, existingAccountId });
    return {
      loginId,
      verificationUrl: `${this.issuer}/codex/device`,
      userCode,
      intervalSeconds,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  /** Polls one device authorization exactly once; clients control retry cadence. */
  async poll(loginId: string): Promise<OAuthPollResult> {
    const pending = this.pending.get(loginId);
    if (!pending) throw new NotFoundException('Device login session not found');
    if (Date.now() >= pending.expiresAtMs) {
      this.pending.delete(loginId);
      return { status: 'expired', existingAccountId: pending.existingAccountId };
    }

    const response = await this.fetchImpl(`${this.issuer}/api/accounts/deviceauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_auth_id: pending.deviceAuthId, user_code: pending.userCode }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 403 || response.status === 404) {
      return { status: 'pending', existingAccountId: pending.existingAccountId };
    }
    if (!response.ok) throw new BadRequestException(`Device login poll failed with HTTP ${response.status}`);

    const auth = await response.json() as DevicePollSuccess;
    if (!auth.authorization_code || !auth.code_verifier) throw new BadRequestException('Device login authorization response is invalid');
    const bundle = await this.exchangeAuthorizationCode(auth.authorization_code, auth.code_verifier);
    this.pending.delete(loginId);
    return { status: 'complete', existingAccountId: pending.existingAccountId, bundle };
  }

  /** Persists long-lived OAuth material after AccountsService has selected the stable local account id. */
  async persistBundle(accountId: string, bundle: CodexOAuthTokenBundle): Promise<void> {
    await this.store.save(accountId, {
      refreshToken: bundle.refreshToken,
      idToken: bundle.idToken,
      updatedAt: new Date().toISOString(),
    });
    this.accessCache.set(accountId, {
      token: bundle.accessToken,
      expiresAtMs: jwtExpirationMs(bundle.accessToken) || Date.now() + 5 * 60 * 1000,
    });
  }

  /** Resolves a fresh token bundle, serializing refreshes per account. */
  async tokenBundle(accountId: string): Promise<CodexOAuthTokenBundle> {
    const cached = this.accessCache.get(accountId);
    const stored = await this.store.read(accountId);
    if (cached && cached.expiresAtMs - Date.now() > 60_000) {
      return {
        idToken: stored.idToken,
        accessToken: cached.token,
        refreshToken: stored.refreshToken,
        identity: parseCodexIdentity(stored.idToken),
      };
    }

    const existing = this.refreshLocks.get(accountId);
    if (existing) return existing;
    const refresh = this.refresh(accountId, stored).finally(() => this.refreshLocks.delete(accountId));
    this.refreshLocks.set(accountId, refresh);
    return refresh;
  }

  /** Deletes persisted and cached OAuth material. */
  async deleteAccountCredential(accountId: string): Promise<void> {
    this.accessCache.delete(accountId);
    await this.store.delete(accountId);
  }

  private async exchangeAuthorizationCode(code: string, codeVerifier: string): Promise<CodexOAuthTokenBundle> {
    const response = await this.fetchImpl(`${this.issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code,
        redirect_uri: `${this.issuer}/deviceauth/callback`,
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new BadRequestException(`OAuth token exchange failed with HTTP ${response.status}`);
    return tokenBundleFromResponse(await response.json() as TokenResponse);
  }

  private async refresh(accountId: string, stored: { refreshToken: string; idToken: string }): Promise<CodexOAuthTokenBundle> {
    const response = await this.fetchImpl(`${this.issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        refresh_token: stored.refreshToken,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new BadRequestException(`OAuth refresh failed with HTTP ${response.status}`);
    const body = await response.json() as TokenResponse;
    if (!body.access_token) throw new BadRequestException('OAuth refresh response is missing access_token');
    const bundle: CodexOAuthTokenBundle = {
      idToken: body.id_token || stored.idToken,
      accessToken: body.access_token,
      refreshToken: body.refresh_token || stored.refreshToken,
      identity: parseCodexIdentity(body.id_token || stored.idToken),
    };
    await this.persistBundle(accountId, bundle);
    return bundle;
  }
}

/** Parses stable identity metadata from Codex ChatGPT id tokens. */
export function parseCodexIdentity(idToken: string): CodexOAuthIdentity {
  const payload = parseJwtPayload(idToken);
  const auth = isRecord(payload['https://api.openai.com/auth'])
    ? payload['https://api.openai.com/auth'] as Record<string, unknown>
    : {};
  return {
    email: scalar(payload.email),
    identitySubject: scalar(auth.chatgpt_user_id || auth.user_id || payload.sub),
    externalAccountId: scalar(auth.chatgpt_account_id),
    planType: scalar(auth.chatgpt_plan_type),
    isFedramp: auth.chatgpt_account_is_fedramp === true,
  };
}

/** Builds the current Codex auth.json id_token object around the raw JWT. */
export function codexIdTokenInfo(idToken: string): Record<string, unknown> {
  const identity = parseCodexIdentity(idToken);
  return {
    email: identity.email,
    chatgpt_plan_type: identity.planType,
    chatgpt_user_id: identity.identitySubject,
    chatgpt_account_id: identity.externalAccountId,
    chatgpt_account_is_fedramp: identity.isFedramp,
    raw_jwt: idToken,
  };
}

function tokenBundleFromResponse(body: TokenResponse): CodexOAuthTokenBundle {
  if (!body.id_token || !body.access_token || !body.refresh_token) {
    throw new BadRequestException('OAuth token response is incomplete');
  }
  return {
    idToken: body.id_token,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    identity: parseCodexIdentity(body.id_token),
  };
}

function parseJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  if (!part) throw new BadRequestException('OAuth id token is invalid');
  try {
    const parsed = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as unknown;
    if (!isRecord(parsed)) throw new Error('JWT payload must be an object');
    return parsed;
  } catch {
    throw new BadRequestException('OAuth id token is invalid');
  }
}

function jwtExpirationMs(token: string): number | undefined {
  try {
    const exp = parseJwtPayload(token).exp;
    return typeof exp === 'number' ? exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}
function scalar(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

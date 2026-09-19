import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProviderCredentialSummary } from '@ai-manage/shared';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DATA_DIR } from '../utils.js';
import type { ApiKeyCredentialFile, StoredApiKeyCredential } from './credential-store.types.js';

@Injectable()
export class CredentialStoreService {
  private filePath = resolve(DATA_DIR, 'credentials', 'api-keys.json');

  static forFile(filePath: string): CredentialStoreService {
    const service = new CredentialStoreService();
    service.filePath = filePath;
    return service;
  }

  /** Stores an API key and returns only its non-secret summary. */
  async createApiKey(value: string): Promise<ProviderCredentialSummary> {
    const secret = value.trim();
    if (!secret) throw new Error('API key is required');
    const file = await this.readStore();
    const now = new Date().toISOString();
    const credential: StoredApiKeyCredential = { id: randomUUID(), kind: 'api_key', value: secret, createdAt: now, updatedAt: now };
    file.credentials[credential.id] = credential;
    await this.writeStore(file);
    return this.summary(credential.id);
  }

  /** Replaces one API key without returning secret material. */
  async replaceApiKey(id: string, value: string): Promise<ProviderCredentialSummary> {
    const secret = value.trim();
    if (!secret) throw new Error('API key is required');
    const file = await this.readStore();
    const current = file.credentials[id];
    if (!current) throw new NotFoundException('Credential not found');
    file.credentials[id] = { ...current, value: secret, updatedAt: new Date().toISOString() };
    await this.writeStore(file);
    return this.summary(id);
  }

  /** Reads an API key for internal projection use only. */
  async readApiKey(id: string): Promise<string> {
    const credential = (await this.readStore()).credentials[id];
    if (!credential) throw new NotFoundException('Credential not found');
    return credential.value;
  }

  /** Removes a credential by id. */
  async deleteCredential(id: string): Promise<void> {
    const file = await this.readStore();
    if (!file.credentials[id]) return;
    delete file.credentials[id];
    await this.writeStore(file);
  }

  /** Returns whether a credential exists. */
  async hasCredential(id?: string): Promise<boolean> {
    if (!id) return false;
    return !!(await this.readStore()).credentials[id];
  }

  /** Returns a safe summary without secret values. */
  async summary(id: string): Promise<ProviderCredentialSummary> {
    return { id, kind: 'api_key', configured: await this.hasCredential(id) };
  }

  private async readStore(): Promise<ApiKeyCredentialFile> {
    if (!existsSync(this.filePath)) return { version: 1, credentials: {} };
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as ApiKeyCredentialFile;
      return { version: 1, credentials: parsed?.credentials && typeof parsed.credentials === 'object' ? parsed.credentials : {} };
    } catch {
      throw new Error('Credential store is invalid');
    }
  }

  private async writeStore(file: ApiKeyCredentialFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(file, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    try { await chmod(tempPath, 0o600); } catch { /* best effort on non-Unix platforms */ }
    await rename(tempPath, this.filePath);
  }
}

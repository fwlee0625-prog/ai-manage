import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DATA_DIR } from '../../utils.js';

export interface StoredCodexOAuthCredential {
  refreshToken: string;
  idToken: string;
  updatedAt: string;
}

interface OAuthStoreFile {
  version: 1;
  accounts: Record<string, StoredCodexOAuthCredential>;
}

@Injectable()
export class CodexOAuthStoreService {
  private filePath = resolve(DATA_DIR, 'credentials', 'codex-oauth.json');

  static forFile(filePath: string): CodexOAuthStoreService {
    const store = new CodexOAuthStoreService();
    store.filePath = filePath;
    return store;
  }

  /** Persists refresh/id tokens only; access tokens stay memory-only. */
  async save(accountId: string, credential: StoredCodexOAuthCredential): Promise<void> {
    const file = await this.readStore();
    file.accounts[accountId] = credential;
    await this.writeStore(file);
  }

  /** Reads one OAuth credential for internal refresh use. */
  async read(accountId: string): Promise<StoredCodexOAuthCredential> {
    const credential = (await this.readStore()).accounts[accountId];
    if (!credential) throw new NotFoundException('OAuth credential not found');
    return credential;
  }

  /** Deletes one account credential. */
  async delete(accountId: string): Promise<void> {
    const file = await this.readStore();
    if (!file.accounts[accountId]) return;
    delete file.accounts[accountId];
    await this.writeStore(file);
  }

  private async readStore(): Promise<OAuthStoreFile> {
    if (!existsSync(this.filePath)) return { version: 1, accounts: {} };
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as OAuthStoreFile;
      return { version: 1, accounts: parsed?.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {} };
    } catch {
      throw new Error('Codex OAuth credential store is invalid');
    }
  }

  private async writeStore(file: OAuthStoreFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(file, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    try { await chmod(tempPath, 0o600); } catch { /* best effort on non-Unix platforms */ }
    await rename(tempPath, this.filePath);
  }
}

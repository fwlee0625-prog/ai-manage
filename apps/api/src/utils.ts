import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const HOME_DIR = homedir();
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
export const DATA_DIR = resolve(PROJECT_ROOT, '.data');

export function stableId(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

export function toIsoFromMs(value?: number | string | null): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return undefined;
  const timestamp = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  return new Date(timestamp).toISOString();
}

export function clampPage(value: unknown): number {
  const page = Number(value || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function clampPageSize(value: unknown): number {
  const pageSize = Number(value || 30);
  if (!Number.isFinite(pageSize) || pageSize < 1) return 30;
  return Math.min(Math.floor(pageSize), 5000);
}

export function normalizeText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Maps items with bounded concurrency, preserving the input order in the result.
 *
 * 用于对大量文件做受限并发处理（例如全量读取会话 jsonl 提取用量），
 * 避免 `Promise.all` 一次性打开过多文件句柄触发 EMFILE。
 */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length || 1));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export function fileFormat(filePath: string): 'json' | 'toml' | 'markdown' | 'jsonl' | 'text' {
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.toml')) return 'toml';
  if (filePath.endsWith('.md')) return 'markdown';
  if (filePath.endsWith('.jsonl')) return 'jsonl';
  return 'text';
}

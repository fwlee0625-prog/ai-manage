import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline/promises';

export async function readJsonl<T = unknown>(filePath: string, limit = Number.POSITIVE_INFINITY): Promise<T[]> {
  const rows: T[] = [];
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed) as T);
    } catch {
      rows.push({ raw: trimmed, parseError: true } as T);
    }
    if (rows.length >= limit) {
      rl.close();
      break;
    }
  }

  return rows;
}

export async function countJsonl(filePath: string): Promise<number> {
  let count = 0;
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  for await (const line of rl) {
    if (line.trim()) count += 1;
  }
  return count;
}

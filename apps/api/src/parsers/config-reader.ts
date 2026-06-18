import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { ConfigFileDetail, ConfigFileSummary, SaveConfigFileRequest } from '@ai-manage/shared';
import { fileFormat, stableId } from '../utils.js';
import { parseTomlLoose, serializeTomlLoose } from './toml.js';

export type ConfigSummaryOptions = Pick<ConfigFileSummary, 'category' | 'editable' | 'formKind' | 'hiddenFromConfigPage'>;

const DEFAULT_CONFIG_OPTIONS: ConfigSummaryOptions = {
  category: 'runtime',
  editable: false,
  formKind: 'readonly',
  hiddenFromConfigPage: true,
};

export async function buildConfigSummary(
  tool: ConfigFileSummary['tool'],
  filePath: string,
  options: Partial<ConfigSummaryOptions> & { name?: string } = {},
): Promise<ConfigFileSummary> {
  const meta = await stat(filePath);
  const { name, ...metadata } = options;
  return {
    id: stableId(`${tool}:${filePath}`),
    tool,
    name: name || filePath.split('/').at(-1) || filePath,
    path: filePath,
    format: fileFormat(filePath),
    size: meta.size,
    updatedAt: meta.mtime.toISOString(),
    ...DEFAULT_CONFIG_OPTIONS,
    ...metadata,
  };
}

export async function readConfigDetail(summary: ConfigFileSummary): Promise<ConfigFileDetail> {
  const raw = await readFile(summary.path, 'utf8');
  const parsed = parseConfigRaw(summary, raw);

  return {
    ...summary,
    raw,
    parsed,
    hash: hashConfigRaw(raw),
    formModel: summary.formKind === 'markdown-instruction' ? raw : parsed,
  };
}

export function hashConfigRaw(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function parseConfigRaw(summary: Pick<ConfigFileSummary, 'format'>, raw: string): unknown {
  if (summary.format === 'json') return JSON.parse(raw);
  if (summary.format === 'toml') return parseTomlLoose(raw);
  if (summary.format === 'jsonl') {
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 200)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return line;
        }
      });
  }
  return undefined;
}

export function serializeConfigRequest(summary: ConfigFileSummary, body: SaveConfigFileRequest): string {
  if (body.mode === 'raw') {
    if (typeof body.raw !== 'string') throw new Error('raw must be a string');
    parseConfigRaw(summary, body.raw);
    return body.raw.endsWith('\n') ? body.raw : `${body.raw}\n`;
  }

  if (summary.format === 'json') return `${JSON.stringify(body.parsed ?? {}, null, 2)}\n`;
  if (summary.format === 'toml') return serializeTomlLoose(body.parsed ?? {});
  if (summary.format === 'markdown') {
    const raw = typeof body.raw === 'string' ? body.raw : String(body.parsed ?? '');
    return raw.endsWith('\n') ? raw : `${raw}\n`;
  }
  throw new Error(`Unsupported editable config format: ${summary.format}`);
}

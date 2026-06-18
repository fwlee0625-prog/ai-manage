export function parseTomlLoose(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let current: Record<string, unknown> = result;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const section = trimmed.match(/^\[(.+)]$/);
    if (section) {
      current = result;
      for (const part of splitTomlPath(section[1])) {
        const key = unquoteTomlKey(part.trim());
        if (!current[key] || typeof current[key] !== 'object') current[key] = {};
        current = current[key] as Record<string, unknown>;
      }
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = unquoteTomlKey(trimmed.slice(0, eqIndex).trim());
    const value = trimmed.slice(eqIndex + 1).trim();
    current[key] = parseTomlValue(value);
  }

  return result;
}

export function serializeTomlLoose(value: unknown): string {
  if (!isRecord(value)) return '';
  const lines: string[] = [];
  writeTomlObject(lines, [], value);
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function parseTomlValue(value: string): unknown {
  const withoutComment = stripTomlComment(value).trim();
  if (/^".*"$/.test(withoutComment) || /^'.*'$/.test(withoutComment)) {
    return unquoteTomlString(withoutComment);
  }
  if (withoutComment === 'true') return true;
  if (withoutComment === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(withoutComment)) return Number(withoutComment);
  if (withoutComment.startsWith('[') && withoutComment.endsWith(']')) {
    return splitTomlArray(withoutComment.slice(1, -1))
      .map(item => parseTomlValue(item.trim()))
      .filter(item => item !== '');
  }
  return withoutComment;
}

function writeTomlObject(lines: string[], path: string[], value: Record<string, unknown>) {
  const scalarEntries = Object.entries(value).filter(([, item]) => !isSectionObject(item));
  const sectionEntries = Object.entries(value).filter(([, item]) => isSectionObject(item));

  if (path.length) {
    if (lines.length && lines.at(-1) !== '') lines.push('');
    lines.push(`[${path.map(quoteTomlKey).join('.')}]`);
  }

  for (const [key, item] of scalarEntries) {
    lines.push(`${quoteTomlKey(key)} = ${serializeTomlValue(item)}`);
  }

  for (const [key, item] of sectionEntries) {
    writeTomlObject(lines, [...path, key], item as Record<string, unknown>);
  }
}

function serializeTomlValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(serializeTomlValue).join(', ')}]`;
  if (isRecord(value)) {
    return `{ ${Object.entries(value).map(([key, item]) => `${quoteTomlKey(key)} = ${serializeTomlValue(item)}`).join(', ')} }`;
  }
  return JSON.stringify(value ?? '');
}

function isSectionObject(value: unknown): boolean {
  return isRecord(value) && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function splitTomlPath(value: string): string[] {
  return splitOutsideQuotes(value, '.');
}

function splitTomlArray(value: string): string[] {
  return splitOutsideQuotes(value, ',');
}

function splitOutsideQuotes(value: string, separator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quote === '"') {
      current += char;
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? undefined : char;
      current += char;
      continue;
    }
    if (char === separator && !quote) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim() || value.endsWith(separator)) parts.push(current.trim());
  return parts;
}

function stripTomlComment(value: string): string {
  let quote: '"' | "'" | undefined;
  let escaped = false;
  let result = '';
  for (const char of value) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quote === '"') {
      result += char;
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? undefined : char;
      result += char;
      continue;
    }
    if (char === '#' && !quote) break;
    result += char;
  }
  return result;
}

function unquoteTomlKey(value: string): string {
  return unquoteTomlString(value);
}

function unquoteTomlString(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

function quoteTomlKey(value: string): string {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
}

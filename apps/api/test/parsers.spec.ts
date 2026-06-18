import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJsonl } from '../src/parsers/jsonl.js';
import { parseTomlLoose, serializeTomlLoose } from '../src/parsers/toml.js';

describe('parsers', () => {
  it('reads jsonl and keeps invalid lines as raw rows', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-manage-jsonl-'));
    const file = join(dir, 'sample.jsonl');
    await writeFile(file, '{"role":"user","content":"hi"}\nnot json\n');

    const rows = await readJsonl<Record<string, unknown>>(file);

    expect(rows).toHaveLength(2);
    expect(rows[0].role).toBe('user');
    expect(rows[1].parseError).toBe(true);
  });

  it('parses simple toml sections', () => {
    const parsed = parseTomlLoose('model = "gpt-5.5"\n[tools.codex]\nenabled = true\n');

    expect(parsed).toEqual({
      model: 'gpt-5.5',
      tools: {
        codex: {
          enabled: true,
        },
      },
    });
  });

  it('parses and serializes quoted toml sections', () => {
    const parsed = parseTomlLoose('model = "gpt-5.5"\n[projects."/tmp/a.b"]\ntrusted = true\n');

    expect(parsed).toEqual({
      model: 'gpt-5.5',
      projects: {
        '/tmp/a.b': {
          trusted: true,
        },
      },
    });
    expect(serializeTomlLoose(parsed)).toContain('[projects."/tmp/a.b"]');
  });
});

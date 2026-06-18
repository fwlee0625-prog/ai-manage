import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PathGuard } from '../src/fs/path-guard.js';
import { HOME_DIR } from '../src/utils.js';
import { resolve } from 'node:path';

describe('PathGuard', () => {
  it('rejects paths outside configured roots', () => {
    const guard = new PathGuard();

    expect(() => guard.assertReadable('/etc/passwd')).toThrow(ForbiddenException);
  });

  it('only allows exact editable config paths for writing', () => {
    const guard = new PathGuard();

    expect(guard.assertWritableConfig(resolve(HOME_DIR, '.codex', 'config.toml'))).toBe(resolve(HOME_DIR, '.codex', 'config.toml'));
    expect(() => guard.assertWritableConfig(resolve(HOME_DIR, '.codex', 'history.jsonl'))).toThrow(ForbiddenException);
  });

  it('only allows SKILL.md files under skill roots for writing', () => {
    const guard = new PathGuard();

    expect(guard.assertWritableSkill(resolve(HOME_DIR, '.codex', 'skills', 'demo', 'SKILL.md'))).toBe(resolve(HOME_DIR, '.codex', 'skills', 'demo', 'SKILL.md'));
    expect(guard.assertWritableSkill(resolve(HOME_DIR, '.agents', 'skills', 'demo', 'SKILL.md'))).toBe(resolve(HOME_DIR, '.agents', 'skills', 'demo', 'SKILL.md'));
    expect(() => guard.assertWritableSkill(resolve(HOME_DIR, '.codex', 'skills', 'demo', 'README.md'))).toThrow(ForbiddenException);
  });
});

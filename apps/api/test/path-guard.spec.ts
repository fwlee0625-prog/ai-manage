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
    expect(guard.assertWritableConfig(resolve(HOME_DIR, '.claude.json'))).toBe(resolve(HOME_DIR, '.claude.json'));
    expect(() => guard.assertWritableConfig(resolve(HOME_DIR, '.codex', 'history.jsonl'))).toThrow(ForbiddenException);
  });

  it('only allows the Codex auth file for auth key replacement', () => {
    const guard = new PathGuard();

    expect(guard.assertCodexAuth(resolve(HOME_DIR, '.codex', 'auth.json'))).toBe(resolve(HOME_DIR, '.codex', 'auth.json'));
    expect(() => guard.assertCodexAuth(resolve(HOME_DIR, '.codex', 'config.toml'))).toThrow(ForbiddenException);
    expect(guard.assertWritableCodexAuth(resolve(HOME_DIR, '.codex', 'auth.json'))).toBe(resolve(HOME_DIR, '.codex', 'auth.json'));
    expect(() => guard.assertWritableCodexAuth(resolve(HOME_DIR, '.codex', 'config.toml'))).toThrow(ForbiddenException);
  });

  it('only allows SKILL.md files under skill roots for writing', () => {
    const guard = new PathGuard();

    expect(guard.assertWritableSkill(resolve(HOME_DIR, '.codex', 'skills', 'demo', 'SKILL.md'))).toBe(resolve(HOME_DIR, '.codex', 'skills', 'demo', 'SKILL.md'));
    expect(guard.assertWritableSkill(resolve(HOME_DIR, '.claude', 'skills', 'demo', 'SKILL.md'))).toBe(resolve(HOME_DIR, '.claude', 'skills', 'demo', 'SKILL.md'));
    expect(() => guard.assertWritableSkill(resolve(HOME_DIR, '.codex', 'skills', 'demo', 'README.md'))).toThrow(ForbiddenException);
  });

  it('allows project skill files when a project skill root is provided', () => {
    const guard = new PathGuard();
    const root = resolve(HOME_DIR, 'demo-project', '.codex', 'skills');
    const skillFile = resolve(root, 'demo', 'SKILL.md');

    expect(guard.assertReadableSkill(skillFile, [root])).toBe(skillFile);
    expect(guard.assertWritableSkill(skillFile, [root])).toBe(skillFile);
    expect(() => guard.assertReadableSkill(resolve(HOME_DIR, 'demo-project', 'README.md'), [root])).toThrow(ForbiddenException);
  });
});

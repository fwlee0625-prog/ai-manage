import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { IndexRepository } from '../src/database/index.repository.js';
import { PathGuard } from '../src/fs/path-guard.js';
import { SkillsService } from '../src/routes/skills.service.js';

const temporaryRoots: string[] = [];

class TestPathGuard extends PathGuard {
  override readonly codexRoot: string;
  override readonly claudeRoot: string;
  override readonly agentsRoot: string;
  override readonly dataRoot: string;

  constructor(root: string) {
    super();
    this.codexRoot = resolve(root, '.codex');
    this.claudeRoot = resolve(root, '.claude');
    this.agentsRoot = resolve(root, '.agents');
    this.dataRoot = resolve(root, '.data');
  }
}

describe('SkillsService local favorites', () => {
  afterEach(async () => {
    await Promise.all(temporaryRoots.splice(0).map(root => (
      rm(root, { recursive: true, force: true })
    )));
  });

  it('copies complete Codex and Claude skill directories into one local list', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'ai-manage-skills-'));
    temporaryRoots.push(root);
    await createSkill(resolve(root, '.codex', 'skills', 'codex-demo'), 'codex-demo');
    await createSkill(resolve(root, '.claude', 'skills', 'claude-demo'), 'claude-demo');
    const service = createService(root);

    const [codexSkill] = await service.skills('codex');
    const [claudeSkill] = await service.skills('claude');
    const codexFavorite = await service.favoriteSkill(codexSkill.id);
    await service.favoriteSkill(claudeSkill.id);

    const localSkills = await service.localSkills();

    expect(localSkills).toHaveLength(2);
    expect(localSkills.map(skill => skill.source).sort()).toEqual(['claude', 'codex']);
    expect(localSkills.every(skill => skill.scope === 'local')).toBe(true);
    expect(localSkills.map(skill => skill.originSkillId).sort()).toEqual(
      [codexSkill.id, claudeSkill.id].sort(),
    );
    expect(await readFile(resolve(codexFavorite.localPath, 'references', 'notes.md'), 'utf8'))
      .toBe('supporting material\n');
    await expect(service.skill(codexFavorite.skill.id)).resolves.toMatchObject({
      name: 'codex-demo',
      scope: 'local',
      originSkillId: codexSkill.id,
    });

    await service.favoriteSkill(codexSkill.id);
    await expect(service.localSkills()).resolves.toHaveLength(2);

    const removed = await service.unfavoriteSkill(codexSkill.id);

    expect(removed).toEqual({
      originSkillId: codexSkill.id,
      localPath: codexFavorite.localPath,
    });
    expect(existsSync(codexFavorite.localPath)).toBe(false);
    await expect(service.localSkills()).resolves.toMatchObject([
      { originSkillId: claudeSkill.id, scope: 'local' },
    ]);
  });
});

/** Creates a skill directory with one referenced support file. */
async function createSkill(path: string, name: string) {
  await mkdir(resolve(path, 'references'), { recursive: true });
  await writeFile(resolve(path, 'SKILL.md'), [
    '---',
    `name: ${name}`,
    `description: ${name} description`,
    '---',
    '',
    `# ${name}`,
    '',
  ].join('\n'));
  await writeFile(resolve(path, 'references', 'notes.md'), 'supporting material\n');
}

/** Builds the service with isolated tool and local-data roots. */
function createService(root: string) {
  const index = {
    listProjects: async () => [],
  } as unknown as IndexRepository;
  return new SkillsService(new TestPathGuard(root), index);
}

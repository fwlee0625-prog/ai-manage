import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AiTool,
  FavoriteSkillResponse,
  SaveSkillRequest,
  SaveSkillResponse,
  SkillDetail,
  SkillScope,
  SkillSource,
  SkillSummary,
  UnfavoriteSkillResponse,
} from '@ai-manage/shared';
import { existsSync } from 'node:fs';
import { copyFile, cp, lstat, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { IndexRepository } from '../database/index.repository.js';
import { PathGuard } from '../fs/path-guard.js';
import { hashConfigRaw } from '../parsers/config-reader.js';
import { DATA_DIR, stableId } from '../utils.js';

interface SkillRoot {
  /** AI tool that owns the skill root. */
  source: SkillSource;
  /** Directory that contains one or more skill folders. */
  path: string;
  /** Whether this root is a global tool skill root rather than a project root. */
  system: boolean;
  scope?: SkillScope;
  projectPath?: string;
  projectName?: string;
  originSkillId?: string;
  favoritedAt?: string;
}

interface LocalSkillManifest {
  version: 1;
  originSkillId: string;
  originSource: SkillSource;
  originScope: Exclude<SkillScope, 'local'>;
  originProjectPath?: string;
  originProjectName?: string;
  favoritedAt: string;
}

type OriginalSkillSummary = SkillSummary & {
  scope: Exclude<SkillScope, 'local'>;
};

const LOCAL_SKILL_MANIFEST = '.ai-manage-local-skill.json';

@Injectable()
export class SkillsService {
  constructor(
    private readonly pathGuard: PathGuard,
    private readonly index: IndexRepository,
  ) {}

  /** Lists Codex or Claude skills from local tool skill roots. */
  async skills(tool?: AiTool): Promise<SkillSummary[]> {
    const roots = await this.skillRoots(tool);
    const nested = await Promise.all(roots.map(root => this.listSkillsInRoot(root)));
    return nested.flat().sort((a, b) => {
      const sourceCompare = a.source.localeCompare(b.source);
      if (sourceCompare) return sourceCompare;
      if (a.system !== b.system) return a.system ? -1 : 1;
      const projectCompare = (a.projectName || '').localeCompare(b.projectName || '', 'zh-CN');
      if (projectCompare) return projectCompare;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
  }

  /** Lists local favorite copies without filtering by AI tool. */
  async localSkills(): Promise<SkillSummary[]> {
    const roots = await this.localSkillRoots();
    const summaries = await Promise.all(roots.map(async root => {
      const skillFilePath = resolve(root.path, 'SKILL.md');
      if (!existsSync(skillFilePath)) return undefined;
      return this.buildSkillSummary(root, skillFilePath);
    }));
    return summaries
      .filter((skill): skill is SkillSummary => Boolean(skill))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  /** Copies one complete skill directory into the tool-independent local favorites root. */
  async favoriteSkill(id: string): Promise<FavoriteSkillResponse> {
    const summary = await this.findOriginalSkillSummary(id);
    const existing = (await this.localSkills()).find(skill => skill.originSkillId === summary.id);
    if (existing) return { skill: existing, localPath: existing.path };

    const localRoot = this.localSkillsRoot();
    const safeName = summary.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60) || 'skill';
    const targetPath = resolve(localRoot, `${safeName}-${summary.id.slice(0, 12)}`);
    const temporaryPath = resolve(localRoot, `.tmp-${summary.id}-${process.pid}-${Date.now()}`);
    const manifest: LocalSkillManifest = {
      version: 1,
      originSkillId: summary.id,
      originSource: summary.source,
      originScope: summary.scope,
      originProjectPath: summary.projectPath,
      originProjectName: summary.projectName,
      favoritedAt: new Date().toISOString(),
    };

    await mkdir(localRoot, { recursive: true });
    await rm(temporaryPath, { recursive: true, force: true });
    try {
      await cp(summary.path, temporaryPath, { recursive: true, force: true });
      await writeFile(
        resolve(temporaryPath, LOCAL_SKILL_MANIFEST),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );
      await rm(targetPath, { recursive: true, force: true });
      await rename(temporaryPath, targetPath);
    } finally {
      await rm(temporaryPath, { recursive: true, force: true });
    }

    const skill = (await this.localSkills()).find(item => item.originSkillId === summary.id);
    if (!skill) throw new NotFoundException('Local skill copy was not created');
    return { skill, localPath: targetPath };
  }

  /** Removes one local favorite copy by its original or local stable id. */
  async unfavoriteSkill(id: string): Promise<UnfavoriteSkillResponse> {
    const skill = (await this.localSkills()).find(item => (
      item.originSkillId === id || item.id === id
    ));
    if (!skill || !skill.originSkillId) throw new NotFoundException('Local skill not found');
    const localPath = this.assertInsideLocalSkills(skill.path);
    await rm(localPath, { recursive: true, force: true });
    return {
      originSkillId: skill.originSkillId,
      localPath,
    };
  }

  /** Reads one skill detail by stable id. */
  async skill(id: string): Promise<SkillDetail> {
    const summary = await this.findSkillSummary(id);
    const raw = await readFile(summary.skillFilePath, 'utf8');
    return {
      ...summary,
      raw,
      hash: hashConfigRaw(raw),
    };
  }

  /** Saves a skill file with optimistic hash conflict checks. */
  async saveSkill(id: string, body: SaveSkillRequest): Promise<SaveSkillResponse> {
    const summary = await this.findSkillSummary(id);
    this.pathGuard.assertWritableSkill(summary.skillFilePath, this.writableSkillRoots(summary));
    const currentRaw = await readFile(summary.skillFilePath, 'utf8');
    const currentHash = hashConfigRaw(currentRaw);
    if (body.expectedHash !== currentHash) {
      throw new ConflictException('Skill file changed on disk; refresh before saving');
    }
    const nextRaw = body.raw.endsWith('\n') ? body.raw : `${body.raw}\n`;
    const backupPath = await this.backupSkillFile(summary);
    const tempPath = `${summary.skillFilePath}.ai-manage.tmp`;
    await writeFile(tempPath, nextRaw, 'utf8');
    await rename(tempPath, summary.skillFilePath);
    return {
      detail: await this.skill(id),
      backupPath,
    };
  }

  private async listSkillsInRoot(root: SkillRoot): Promise<SkillSummary[]> {
    if (!existsSync(root.path)) return [];
    const skillFiles: string[] = [];
    await this.walkDirectory(root.path, file => {
      if (basename(file) === 'SKILL.md') skillFiles.push(file);
    });
    return Promise.all(skillFiles.map(file => this.buildSkillSummary(root, file)));
  }

  private async skillRoots(tool?: AiTool): Promise<SkillRoot[]> {
    const roots: SkillRoot[] = [
      { source: 'codex', path: resolve(this.pathGuard.codexRoot, 'skills'), system: true },
      { source: 'claude', path: resolve(this.pathGuard.claudeRoot, 'skills'), system: true },
    ];
    const systemRoots = tool ? roots.filter(root => root.source === tool) : roots;
    return [...systemRoots, ...await this.projectSkillRoots(tool)];
  }

  private async projectSkillRoots(tool?: AiTool): Promise<SkillRoot[]> {
    const projects = await this.index.listProjects(tool);
    const roots: SkillRoot[] = [];
    const seen = new Set<string>();
    for (const project of projects) {
      if (!project.projectPath || !isAbsolute(project.projectPath)) continue;
      const candidates = project.tool === 'codex'
        ? [
            { source: 'codex' as const, path: resolve(project.projectPath, '.codex', 'skills') },
            { source: 'codex' as const, path: resolve(project.projectPath, '.agents', 'skills') },
          ]
        : [{ source: 'claude' as const, path: resolve(project.projectPath, '.claude', 'skills') }];
      for (const candidate of candidates) {
        const key = `${candidate.source}:${candidate.path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        roots.push({
          ...candidate,
          system: false,
          projectPath: project.projectPath,
          projectName: project.projectName,
        });
      }
    }
    return roots;
  }

  /** Reads valid local favorite manifests and converts them into scan roots. */
  private async localSkillRoots(): Promise<SkillRoot[]> {
    const localRoot = this.localSkillsRoot();
    if (!existsSync(localRoot)) return [];
    const entries = await readdir(localRoot, { withFileTypes: true });
    const roots: SkillRoot[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.tmp-')) continue;
      const path = resolve(localRoot, entry.name);
      const manifest = await this.readLocalSkillManifest(resolve(path, LOCAL_SKILL_MANIFEST));
      if (!manifest) continue;
      roots.push({
        source: manifest.originSource,
        path,
        system: false,
        scope: 'local',
        projectPath: manifest.originProjectPath,
        projectName: manifest.originProjectName,
        originSkillId: manifest.originSkillId,
        favoritedAt: manifest.favoritedAt,
      });
    }
    return roots;
  }

  private async buildSkillSummary(root: SkillRoot, skillFilePath: string): Promise<SkillSummary> {
    this.pathGuard.assertReadableSkill(skillFilePath, root.system ? [] : [root.path]);
    const raw = await readFile(skillFilePath, 'utf8');
    const meta = await lstat(skillFilePath);
    const frontmatter = this.parseSkillFrontmatter(raw);
    const path = dirname(skillFilePath);
    const name = frontmatter.name || basename(path);
    return {
      id: stableId(`${root.source}:${skillFilePath}`),
      source: root.source,
      scope: root.scope || (root.system ? 'system' : 'project'),
      name,
      path,
      skillFilePath,
      description: frontmatter.description || this.firstSkillParagraph(raw),
      system: root.system,
      projectPath: root.projectPath,
      projectName: root.projectName,
      originSkillId: root.originSkillId,
      favoritedAt: root.favoritedAt,
      size: meta.size,
      updatedAt: meta.mtime.toISOString(),
    };
  }

  private writableSkillRoots(summary: SkillSummary): string[] {
    if (summary.scope === 'local') return [this.localSkillsRoot()];
    if (summary.system || !summary.projectPath) return [];
    if (summary.source === 'claude') return [resolve(summary.projectPath, '.claude', 'skills')];
    return [
      resolve(summary.projectPath, '.codex', 'skills'),
      resolve(summary.projectPath, '.agents', 'skills'),
    ];
  }

  private async findSkillSummary(id: string): Promise<SkillSummary> {
    const summary = [
      ...await this.skills(),
      ...await this.localSkills(),
    ].find(skill => skill.id === id);
    if (!summary) throw new NotFoundException('Skill not found');
    return summary;
  }

  /** Resolves only tool-owned skills so local copies cannot be favorited recursively. */
  private async findOriginalSkillSummary(id: string): Promise<OriginalSkillSummary> {
    const summary = (await this.skills()).find(skill => skill.id === id);
    if (!summary || summary.scope === 'local') throw new NotFoundException('Skill not found');
    return summary as OriginalSkillSummary;
  }

  private localSkillsRoot(): string {
    return resolve(this.pathGuard.dataRoot, 'local-skills');
  }

  /** Ensures recursive deletion cannot escape the dedicated local favorites root. */
  private assertInsideLocalSkills(path: string): string {
    const localRoot = this.localSkillsRoot();
    const resolved = resolve(path);
    const relativePath = relative(localRoot, resolved);
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new NotFoundException('Local skill not found');
    }
    return resolved;
  }

  private async readLocalSkillManifest(path: string): Promise<LocalSkillManifest | undefined> {
    if (!existsSync(path)) return undefined;
    try {
      const value = JSON.parse(await readFile(path, 'utf8')) as Partial<LocalSkillManifest>;
      if (
        value.version !== 1
        || typeof value.originSkillId !== 'string'
        || !['codex', 'claude'].includes(value.originSource || '')
        || !['system', 'project'].includes(value.originScope || '')
        || typeof value.favoritedAt !== 'string'
      ) return undefined;
      return value as LocalSkillManifest;
    } catch {
      return undefined;
    }
  }

  private async backupSkillFile(summary: SkillSummary): Promise<string> {
    const backupDir = resolve(DATA_DIR, 'backups', 'skills', summary.source);
    await mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = summary.name.replace(/[^A-Za-z0-9._-]/g, '_');
    const backupPath = resolve(backupDir, `${stamp}-${safeName}-SKILL.md`);
    await copyFile(summary.skillFilePath, backupPath);
    return backupPath;
  }

  private parseSkillFrontmatter(raw: string): { name?: string; description?: string } {
    if (!raw.startsWith('---')) return {};
    const end = raw.indexOf('\n---', 3);
    if (end === -1) return {};
    const frontmatter = raw.slice(3, end).trim();
    const result: { name?: string; description?: string } = {};
    for (const line of frontmatter.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (match[1] === 'name') result.name = value;
      if (match[1] === 'description') result.description = value;
    }
    return result;
  }

  private firstSkillParagraph(raw: string): string {
    return raw
      .replace(/^---[\s\S]*?\n---/, '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line && !line.startsWith('#')) || '';
  }

  private async walkDirectory(dir: string, visit: (file: string) => void): Promise<void> {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const fullPath = resolve(dir, entry);
      const meta = await lstat(fullPath);
      if (meta.isDirectory()) await this.walkDirectory(fullPath, visit);
      else if (meta.isFile()) visit(fullPath);
    }
  }
}

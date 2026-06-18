import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  SaveSkillRequest,
  SaveSkillResponse,
  SkillDetail,
  SkillSource,
  SkillSummary,
} from '@ai-manage/shared';
import { existsSync } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { PathGuard } from '../fs/path-guard.js';
import { hashConfigRaw } from '../parsers/config-reader.js';
import { DATA_DIR, stableId } from '../utils.js';

@Injectable()
export class SkillsService {
  constructor(private readonly pathGuard: PathGuard) {}

  /** Lists Codex and Agents skills from local skill roots. */
  async skills(): Promise<SkillSummary[]> {
    const roots: Array<{ source: SkillSource; path: string }> = [
      { source: 'codex', path: resolve(this.pathGuard.codexRoot, 'skills') },
      { source: 'agents', path: resolve(this.pathGuard.agentsRoot, 'skills') },
    ];
    const nested = await Promise.all(roots.map(root => this.listSkillsInRoot(root.source, root.path)));
    return nested.flat().sort((a, b) => {
      const sourceCompare = a.source.localeCompare(b.source);
      if (sourceCompare) return sourceCompare;
      if (a.system !== b.system) return a.system ? 1 : -1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
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
    this.pathGuard.assertWritableSkill(summary.skillFilePath);
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

  private async listSkillsInRoot(source: SkillSource, rootPath: string): Promise<SkillSummary[]> {
    if (!existsSync(rootPath)) return [];
    const skillFiles: string[] = [];
    await this.walkDirectory(rootPath, file => {
      if (basename(file) === 'SKILL.md') skillFiles.push(file);
    });
    return Promise.all(skillFiles.map(file => this.buildSkillSummary(source, rootPath, file)));
  }

  private async buildSkillSummary(source: SkillSource, rootPath: string, skillFilePath: string): Promise<SkillSummary> {
    this.pathGuard.assertReadable(skillFilePath);
    const raw = await readFile(skillFilePath, 'utf8');
    const meta = await lstat(skillFilePath);
    const frontmatter = this.parseSkillFrontmatter(raw);
    const path = dirname(skillFilePath);
    const name = frontmatter.name || basename(path);
    return {
      id: stableId(`${source}:${skillFilePath}`),
      source,
      name,
      path,
      skillFilePath,
      description: frontmatter.description || this.firstSkillParagraph(raw),
      system: relative(rootPath, path).split('/').includes('.system'),
      size: meta.size,
      updatedAt: meta.mtime.toISOString(),
    };
  }

  private async findSkillSummary(id: string): Promise<SkillSummary> {
    const summary = (await this.skills()).find(skill => skill.id === id);
    if (!summary) throw new NotFoundException('Skill not found');
    return summary;
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

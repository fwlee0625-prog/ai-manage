import { Injectable, ForbiddenException } from '@nestjs/common';
import { existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { DATA_DIR, HOME_DIR } from '../utils.js';

@Injectable()
export class PathGuard {
  readonly codexRoot = resolve(HOME_DIR, '.codex');
  readonly claudeRoot = resolve(HOME_DIR, '.claude');
  readonly agentsRoot = resolve(HOME_DIR, '.agents');
  readonly dataRoot = DATA_DIR;
  readonly writableConfigFiles = new Set([
    resolve(this.codexRoot, 'config.toml'),
    resolve(this.codexRoot, 'AGENTS.md'),
    resolve(this.claudeRoot, 'settings.json'),
    resolve(this.claudeRoot, 'settings.local.json'),
    resolve(this.claudeRoot, 'CLAUDE.md'),
  ]);

  allowedRoots(): string[] {
    return [this.codexRoot, this.claudeRoot, this.agentsRoot, this.dataRoot];
  }

  assertReadable(filePath: string): string {
    const resolved = resolve(filePath);
    const allowed = this.allowedRoots().some(root => this.isInside(resolved, root));
    if (!allowed) {
      throw new ForbiddenException(`Path is outside allowed roots: ${filePath}`);
    }
    return resolved;
  }

  assertWritableConfig(filePath: string): string {
    const resolved = resolve(filePath);
    if (!this.writableConfigFiles.has(resolved)) {
      throw new ForbiddenException(`Path is not an editable config file: ${filePath}`);
    }
    return resolved;
  }

  assertWritableSkill(filePath: string): string {
    const resolved = resolve(filePath);
    const allowedRoots = [
      resolve(this.codexRoot, 'skills'),
      resolve(this.agentsRoot, 'skills'),
    ];
    const allowed = resolved.endsWith('/SKILL.md') && allowedRoots.some(root => this.isInside(resolved, root));
    if (!allowed) {
      throw new ForbiddenException(`Path is not an editable skill file: ${filePath}`);
    }
    return resolved;
  }

  assertWritableToolData(filePath: string): string {
    const resolved = resolve(filePath);
    const allowed = [this.codexRoot, this.claudeRoot].some(root => this.isInside(resolved, root));
    if (!allowed) {
      throw new ForbiddenException(`Path is outside writable AI tool data roots: ${filePath}`);
    }
    return resolved;
  }

  existsDirectory(path: string): boolean {
    return existsSync(path) && statSync(path).isDirectory();
  }

  private isInside(child: string, parent: string): boolean {
    const rel = relative(resolve(parent), child);
    return rel === '' || (!!rel && !rel.startsWith('..') && !rel.startsWith('/'));
  }
}

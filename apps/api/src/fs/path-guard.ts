import { Injectable, ForbiddenException } from '@nestjs/common';
import { existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { DATA_DIR, HOME_DIR } from '../utils.js';

@Injectable()
export class PathGuard {
  codexRoot = resolve(HOME_DIR, '.codex');
  claudeRoot = resolve(HOME_DIR, '.claude');
  claudeGlobalConfigPath = resolve(HOME_DIR, '.claude.json');
  agentsRoot = resolve(HOME_DIR, '.agents');
  dataRoot = DATA_DIR;
  codexAuthPath = resolve(this.codexRoot, 'auth.json');
  writableConfigFiles = new Set([
    resolve(this.codexRoot, 'config.toml'),
    resolve(this.codexRoot, 'AGENTS.md'),
    resolve(this.claudeRoot, 'settings.json'),
    resolve(this.claudeRoot, 'settings.local.json'),
    resolve(this.claudeRoot, 'CLAUDE.md'),
    this.claudeGlobalConfigPath,
  ]);

  /** Creates an isolated path guard for integration tests without touching the real user home. */
  static forRoots(codexRoot: string, claudeRoot: string): PathGuard {
    const guard = new PathGuard();
    guard.codexRoot = resolve(codexRoot);
    guard.claudeRoot = resolve(claudeRoot);
    guard.claudeGlobalConfigPath = resolve(claudeRoot, '..', '.claude.json');
    guard.codexAuthPath = resolve(guard.codexRoot, 'auth.json');
    guard.writableConfigFiles = new Set([
      resolve(guard.codexRoot, 'config.toml'),
      resolve(guard.codexRoot, 'AGENTS.md'),
      resolve(guard.claudeRoot, 'settings.json'),
      resolve(guard.claudeRoot, 'settings.local.json'),
      resolve(guard.claudeRoot, 'CLAUDE.md'),
      guard.claudeGlobalConfigPath,
    ]);
    return guard;
  }

  allowedRoots(): string[] {
    return [this.codexRoot, this.claudeRoot, this.agentsRoot, this.dataRoot];
  }

  assertReadable(filePath: string): string {
    const resolved = resolve(filePath);
    const allowed = resolved === this.claudeGlobalConfigPath
      || this.allowedRoots().some(root => this.isInside(resolved, root));
    if (!allowed) {
      throw new ForbiddenException(`Path is outside allowed roots: ${filePath}`);
    }
    return resolved;
  }

  /** Allows reading SKILL.md files from global roots and caller-provided project skill roots. */
  assertReadableSkill(filePath: string, extraRoots: string[] = []): string {
    const resolved = resolve(filePath);
    const allowedRoots = this.skillRoots(extraRoots);
    const allowed = resolved.endsWith('/SKILL.md') && allowedRoots.some(root => this.isInside(resolved, root));
    if (!allowed) {
      throw new ForbiddenException(`Path is not a readable skill file: ${filePath}`);
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

  assertCodexAuth(filePath = this.codexAuthPath): string {
    const resolved = resolve(filePath);
    if (resolved !== this.codexAuthPath) {
      throw new ForbiddenException(`Path is not the Codex auth file: ${filePath}`);
    }
    return resolved;
  }

  assertWritableCodexAuth(filePath = this.codexAuthPath): string {
    return this.assertCodexAuth(filePath);
  }

  /** Allows editing SKILL.md files from global roots and caller-provided project skill roots. */
  assertWritableSkill(filePath: string, extraRoots: string[] = []): string {
    const resolved = resolve(filePath);
    const allowedRoots = this.skillRoots(extraRoots);
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

  /** Builds the effective whitelist for skill file operations. */
  private skillRoots(extraRoots: string[]): string[] {
    return [
      resolve(this.codexRoot, 'skills'),
      resolve(this.claudeRoot, 'skills'),
      ...extraRoots.map(root => resolve(root)),
    ];
  }
}

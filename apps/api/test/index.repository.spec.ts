import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { IndexRepository } from '../src/database/index.repository.js';

describe('IndexRepository', () => {
  async function createRepository() {
    const dir = await mkdtemp(resolve(tmpdir(), 'ai-manage-index-'));
    const repository = IndexRepository.forDatabase(resolve(dir, 'index.sqlite'));
    await repository.init();
    return repository;
  }

  it('stores and searches session summaries', async () => {
    const repository = await createRepository();
    await repository.replaceToolSessions('codex', [
      {
        id: 'session-a',
        tool: 'codex',
        title: 'Fix router issue',
        projectPath: '/tmp/project-a',
        updatedAt: '2026-06-15T00:00:00.000Z',
        sourcePath: '/Users/fanwei/.codex/state_5.sqlite',
        messageCount: 3,
        preview: 'vue router no match',
      },
    ]);

    const result = await repository.findSessions({ tool: 'codex', keyword: 'router', page: 1, pageSize: 10 });

    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items.some(item => item.id === 'session-a')).toBe(true);
  });

  it('records schema migrations once', async () => {
    const repository = await createRepository();

    await repository.init();

    expect(await repository.appliedMigrationVersions()).toEqual([1]);
  });

  it('groups projects from the full index and filters sessions by exact project path', async () => {
    const repository = await createRepository();
    await repository.replaceToolSessions('codex', [
      {
        id: 'session-project-a',
        tool: 'codex',
        title: 'Project A',
        projectPath: '/tmp/project',
        updatedAt: '2026-06-15T00:00:00.000Z',
        sourcePath: '/Users/fanwei/.codex/state_5.sqlite',
        messageCount: 1,
        preview: '',
      },
      {
        id: 'session-project-b',
        tool: 'codex',
        title: 'Project B',
        projectPath: '/tmp/project-next',
        updatedAt: '2026-06-15T01:00:00.000Z',
        sourcePath: '/Users/fanwei/.codex/state_5.sqlite',
        messageCount: 1,
        preview: '',
      },
    ]);

    const projects = await repository.listProjects('codex');
    const result = await repository.findSessions({ tool: 'codex', projectPath: '/tmp/project', page: 1, pageSize: 10 });

    expect(projects.some(project => project.projectPath === '/tmp/project' && project.sessionCount === 1)).toBe(true);
    expect(result.items.map(item => item.id)).toEqual(['session-project-a']);
  });

  it('keeps codex thread titles from session_index thread_name when available', async () => {
    const repository = await createRepository();
    await repository.replaceToolSessions('codex', [
      {
        id: 'session-title-a',
        tool: 'codex',
        title: '开发移动端预约登记',
        projectPath: '/tmp/project-a',
        updatedAt: '2026-06-15T00:00:00.000Z',
        sourcePath: '/Users/fanwei/.codex/state_5.sqlite',
        messageCount: 1,
        preview: '',
      },
    ]);

    const summary = await repository.getSession('codex', 'session-title-a');

    expect(summary?.title).toBe('开发移动端预约登记');
  });

  it('removes deleted sessions from project aggregation', async () => {
    const repository = await createRepository();
    await repository.replaceToolSessions('claude', [
      {
        id: 'session-delete-a',
        tool: 'claude',
        title: 'Delete A',
        projectPath: '/tmp/project',
        updatedAt: '2026-06-15T00:00:00.000Z',
        sourcePath: '/Users/fanwei/.claude/projects/project/session-a.jsonl',
        messageCount: 1,
        preview: '',
      },
      {
        id: 'session-delete-b',
        tool: 'claude',
        title: 'Delete B',
        projectPath: '/tmp/project',
        updatedAt: '2026-06-15T01:00:00.000Z',
        sourcePath: '/Users/fanwei/.claude/projects/project/session-b.jsonl',
        messageCount: 1,
        preview: '',
      },
    ]);

    await repository.deleteSession('claude', 'session-delete-a');

    const projects = await repository.listProjects('claude');
    const result = await repository.findSessions({ tool: 'claude', projectPath: '/tmp/project', page: 1, pageSize: 10 });

    expect(projects.find(project => project.projectPath === '/tmp/project')?.sessionCount).toBe(1);
    expect(result.items.map(item => item.id)).toEqual(['session-delete-b']);
  });

  it('replaces one tool sessions in a single indexed set', async () => {
    const repository = await createRepository();
    await repository.replaceToolSessions('codex', [
      {
        id: 'old-session',
        tool: 'codex',
        title: 'Old',
        projectPath: '/tmp/project',
        updatedAt: '2026-06-15T00:00:00.000Z',
        sourcePath: '/Users/fanwei/.codex/state_5.sqlite',
        messageCount: 1,
        preview: '',
      },
    ]);

    await repository.replaceToolSessions('codex', [
      {
        id: 'new-session',
        tool: 'codex',
        title: 'New',
        projectPath: '/tmp/project',
        updatedAt: '2026-06-16T00:00:00.000Z',
        sourcePath: '/Users/fanwei/.codex/state_5.sqlite',
        messageCount: 1,
        preview: '',
      },
    ]);

    const result = await repository.findSessions({ tool: 'codex', page: 1, pageSize: 10 });

    expect(result.items.map(item => item.id)).toEqual(['new-session']);
  });
});

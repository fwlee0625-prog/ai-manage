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

    expect(await repository.appliedMigrationVersions()).toEqual([1, 2, 3]);
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

  it('persists usage stats and returns them through session queries', async () => {
    const repository = await createRepository();
    await repository.replaceToolSessions('claude', [
      {
        id: 'session-usage-a',
        tool: 'claude',
        title: 'Usage A',
        projectPath: '/tmp/usage-project',
        updatedAt: '2026-06-15T00:00:00.000Z',
        sourcePath: '/tmp/session-a.jsonl',
        messageCount: 12,
        preview: '',
        usage: {
          inputTokens: 300,
          cacheReadTokens: 130,
          cacheWriteTokens: 10,
          outputTokens: 60,
          totalTokens: 500,
          toolCallCount: 3,
          toolCallBreakdown: { Read: 2, Edit: 1 },
          model: 'claude-sonnet-4',
          models: ['claude-sonnet-4', 'gpt-5.2'],
        },
      },
    ]);

    const summary = await repository.getSession('claude', 'session-usage-a');
    const listed = await repository.findSessions({ tool: 'claude', page: 1, pageSize: 10 });

    expect(summary?.usage?.totalTokens).toBe(500);
    expect(summary?.usage?.toolCallBreakdown).toEqual({ Read: 2, Edit: 1 });
    expect(summary?.usage?.model).toBe('claude-sonnet-4');
    expect(summary?.usage?.models).toEqual(['claude-sonnet-4', 'gpt-5.2']);
    expect(listed.items[0]?.usage?.inputTokens).toBe(300);
  });

  it('omits usage payloads when all totals are zero', async () => {
    const repository = await createRepository();
    await repository.replaceToolSessions('codex', [
      {
        id: 'session-no-usage',
        tool: 'codex',
        title: 'No Usage',
        projectPath: '/tmp/project',
        updatedAt: '2026-06-15T00:00:00.000Z',
        sourcePath: '/tmp/session.jsonl',
        messageCount: 1,
        preview: '',
      },
    ]);

    const summary = await repository.getSession('codex', 'session-no-usage');

    expect(summary?.usage).toBeUndefined();
  });

  it('aggregates per-project usage and merges tool call breakdowns', async () => {
    const repository = await createRepository();
    await repository.replaceToolSessions('claude', [
      {
        id: 'usage-p1-a',
        tool: 'claude',
        title: 'P1 A',
        projectPath: '/tmp/project-one',
        updatedAt: '2026-06-15T00:00:00.000Z',
        sourcePath: '/tmp/a.jsonl',
        messageCount: 1,
        preview: '',
        usage: { inputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 50, totalTokens: 150, toolCallCount: 2, toolCallBreakdown: { Read: 2 } },
      },
      {
        id: 'usage-p1-b',
        tool: 'claude',
        title: 'P1 B',
        projectPath: '/tmp/project-one',
        updatedAt: '2026-06-16T00:00:00.000Z',
        sourcePath: '/tmp/b.jsonl',
        messageCount: 1,
        preview: '',
        usage: { inputTokens: 200, cacheReadTokens: 20, cacheWriteTokens: 0, outputTokens: 30, totalTokens: 250, toolCallCount: 1, toolCallBreakdown: { Bash: 1 } },
      },
      {
        id: 'usage-p2',
        tool: 'claude',
        title: 'P2',
        projectPath: '/tmp/project-two',
        updatedAt: '2026-06-16T00:00:00.000Z',
        sourcePath: '/tmp/c.jsonl',
        messageCount: 1,
        preview: '',
        usage: { inputTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 500, totalTokens: 1500, toolCallCount: 0, toolCallBreakdown: {} },
      },
    ]);

    const projects = await repository.listProjectUsage('claude');

    expect(projects.map(project => project.projectPath)).toEqual(['/tmp/project-two', '/tmp/project-one']);
    const projectOne = projects[1];
    expect(projectOne.sessionCount).toBe(2);
    expect(projectOne.usage).toEqual({
      inputTokens: 300,
      cacheReadTokens: 20,
      cacheWriteTokens: 0,
      outputTokens: 80,
      totalTokens: 400,
      toolCallCount: 3,
    });
    expect(projectOne.toolCallBreakdown).toEqual({ Read: 2, Bash: 1 });
  });

  it('aggregates daily usage buckets ascending within the requested window', async () => {
    const repository = await createRepository();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await repository.replaceToolSessions('claude', [
      {
        id: 'daily-today',
        tool: 'claude',
        title: 'Today',
        projectPath: '/tmp/daily-project',
        updatedAt: twoHoursAgo,
        sourcePath: '/tmp/today.jsonl',
        messageCount: 1,
        preview: '',
        usage: { inputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 10, totalTokens: 110, toolCallCount: 1, toolCallBreakdown: {} },
      },
      {
        id: 'daily-older',
        tool: 'claude',
        title: 'Older',
        projectPath: '/tmp/daily-project',
        updatedAt: twoDaysAgo,
        sourcePath: '/tmp/older.jsonl',
        messageCount: 1,
        preview: '',
        usage: { inputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 20, totalTokens: 220, toolCallCount: 2, toolCallBreakdown: {} },
      },
      {
        id: 'daily-other-project',
        tool: 'claude',
        title: 'Other',
        projectPath: '/tmp/other-project',
        updatedAt: twoDaysAgo,
        sourcePath: '/tmp/other.jsonl',
        messageCount: 1,
        preview: '',
        usage: { inputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 50, totalTokens: 550, toolCallCount: 0, toolCallBreakdown: {} },
      },
    ]);

    const month = await repository.dailyUsage('claude', undefined, 30);
    expect(month.map(point => point.sessionCount)).toEqual([2, 1]);
    expect(month.map(point => point.totalTokens)).toEqual([770, 110]);

    const todayOnly = await repository.dailyUsage('claude', undefined, 1);
    expect(todayOnly).toHaveLength(1);
    expect(todayOnly[0]?.sessionCount).toBe(1);
    expect(todayOnly[0]?.totalTokens).toBe(110);

    const otherProject = await repository.dailyUsage('claude', '/tmp/other-project', 30);
    expect(otherProject).toHaveLength(1);
    expect(otherProject[0]?.totalTokens).toBe(550);
  });
});

import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ClaudeAdapter } from '../src/adapters/claude.adapter.js';
import { PathGuard } from '../src/fs/path-guard.js';
import { createClaudeUsageCollector, createCodexUsageCollector } from '../src/parsers/session-usage.js';

describe('createCodexUsageCollector', () => {
  it('keeps the last non-null cumulative token_count snapshot instead of summing events', () => {
    const collector = createCodexUsageCollector();
    // 首个事件 info 可能为 null
    collector.add({ type: 'event_msg', payload: { type: 'token_count', info: null } });
    // 累计快照会随轮次重复出现，后值覆盖前值而非累加
    collector.add({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: {
      input_tokens: 100,
      cached_input_tokens: 40,
      cache_write_input_tokens: 0,
      output_tokens: 10,
      total_tokens: 110,
    } } } });
    collector.add({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: {
      input_tokens: 150,
      cached_input_tokens: 60,
      cache_write_input_tokens: 5,
      output_tokens: 30,
      total_tokens: 180,
    } } } });

    const usage = collector.usage();

    expect(usage.inputTokens).toBe(150);
    expect(usage.cacheReadTokens).toBe(60);
    expect(usage.cacheWriteTokens).toBe(5);
    expect(usage.outputTokens).toBe(30);
    expect(usage.totalTokens).toBe(180);
    expect(usage.toolCallCount).toBe(0);
    expect(usage.toolCallBreakdown).toEqual({});
  });

  it('counts function_call and custom_tool_call response items per tool name', () => {
    const collector = createCodexUsageCollector();
    collector.add({ type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: '{}', call_id: 'a' } });
    collector.add({ type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch', input: '' } });
    collector.add({ type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: '{}', call_id: 'b' } });
    collector.add({ type: 'response_item', payload: { type: 'function_call_output', call_id: 'a', output: 'ok' } });

    const usage = collector.usage();

    expect(usage.toolCallCount).toBe(3);
    expect(usage.toolCallBreakdown).toEqual({ exec_command: 2, apply_patch: 1 });
  });

  it('keeps the last turn_context model and dedupes the ordered model list', () => {
    const collector = createCodexUsageCollector();
    collector.add({ type: 'turn_context', payload: { model: 'gpt-5-codex' } });
    collector.add({ type: 'turn_context', payload: { model: 'gpt-5.2' } });
    collector.add({ type: 'turn_context', payload: { model: 'gpt-5-codex' } });

    const usage = collector.usage();

    expect(usage.model).toBe('gpt-5-codex');
    expect(usage.models).toEqual(['gpt-5-codex', 'gpt-5.2']);
  });
});

describe('createClaudeUsageCollector', () => {
  it('sums per-call usage across assistant rows including cache fields', () => {
    const collector = createClaudeUsageCollector();
    collector.add({ type: 'assistant', message: {
      role: 'assistant',
      model: 'claude-sonnet-4',
      usage: { input_tokens: 100, cache_read_input_tokens: 50, cache_creation_input_tokens: 10, output_tokens: 20 },
      content: [{ type: 'text', text: 'hi' }],
    } });
    collector.add({ type: 'assistant', message: {
      role: 'assistant',
      model: 'claude-sonnet-4',
      usage: { input_tokens: 200, cache_read_input_tokens: 80, cache_creation_input_tokens: 0, output_tokens: 40 },
      content: [],
    } });

    const usage = collector.usage();

    expect(usage.inputTokens).toBe(300);
    expect(usage.cacheReadTokens).toBe(130);
    expect(usage.cacheWriteTokens).toBe(10);
    expect(usage.outputTokens).toBe(60);
    expect(usage.totalTokens).toBe(500);
    expect(usage.model).toBe('claude-sonnet-4');
    expect(usage.models).toEqual(['claude-sonnet-4']);
  });

  it('counts tool_use blocks by name and includes sidechain rows', () => {
    const collector = createClaudeUsageCollector();
    collector.add({ type: 'assistant', message: {
      role: 'assistant',
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }],
    } });
    // isSidechain 子代理流量同样计入
    collector.add({ type: 'assistant', isSidechain: true, message: {
      role: 'assistant',
      usage: { input_tokens: 20, output_tokens: 8 },
      content: [
        { type: 'tool_use', id: 't2', name: 'Bash', input: {} },
        { type: 'tool_use', id: 't3', name: 'Read', input: {} },
      ],
    } });
    collector.add({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1' }] } });

    const usage = collector.usage();

    expect(usage.toolCallCount).toBe(3);
    expect(usage.toolCallBreakdown).toEqual({ Read: 2, Bash: 1 });
    expect(usage.totalTokens).toBe(43);
  });

  it('ignores rows without assistant messages', () => {
    const collector = createClaudeUsageCollector();
    collector.add({ type: 'permission-mode' });
    collector.add({ type: 'file-history-snapshot', messageId: 'x' });
    collector.add({ type: 'user', message: { role: 'user', content: 'hello' } });

    const usage = collector.usage();

    expect(usage.totalTokens).toBe(0);
    expect(usage.toolCallCount).toBe(0);
    expect(usage.model).toBeUndefined();
    expect(usage.models).toBeUndefined();
  });
});

describe('ClaudeAdapter usage extraction', () => {
  it('derives session summaries with usage stats from project jsonl files', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'ai-manage-claude-'));
    const claudeRoot = join(root, '.claude');
    const projectDir = join(claudeRoot, 'projects', 'tmp-fixture-project');
    await mkdir(projectDir, { recursive: true });
    const sessionFile = join(projectDir, 'sid-1.jsonl');
    await writeFile(sessionFile, [
      JSON.stringify({ type: 'user', sessionId: 'sid-1', cwd: '/tmp/fixture-project', timestamp: '2026-06-14T08:00:00.000Z', message: { role: 'user', content: '帮我统计token' } }),
      JSON.stringify({ type: 'assistant', sessionId: 'sid-1', timestamp: '2026-06-14T08:01:00.000Z', message: {
        role: 'assistant', model: 'claude-sonnet-4',
        usage: { input_tokens: 100, cache_read_input_tokens: 50, cache_creation_input_tokens: 10, output_tokens: 20 },
        content: [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }],
      } }),
      JSON.stringify({ type: 'assistant', sessionId: 'sid-1', isSidechain: true, timestamp: '2026-06-14T08:02:00.000Z', message: {
        role: 'assistant', model: 'claude-opus-4-5',
        usage: { input_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 40 },
        content: [
          { type: 'tool_use', id: 't2', name: 'Bash', input: {} },
          { type: 'tool_use', id: 't3', name: 'Read', input: {} },
        ],
      } }),
      JSON.stringify({ type: 'permission-mode', timestamp: '2026-06-14T09:00:00.000Z' }),
    ].join('\n'));

    const codexRoot = join(root, '.codex');
    await mkdir(codexRoot, { recursive: true });
    const adapter = new ClaudeAdapter(PathGuard.forRoots(codexRoot, claudeRoot));
    const sessions = await adapter.scanSessions();

    expect(sessions).toHaveLength(1);
    const summary = sessions[0];
    expect(summary.projectPath).toBe('/tmp/fixture-project');
    expect(summary.messageCount).toBe(4);
    expect(summary.usage).toMatchObject({
      inputTokens: 300,
      cacheReadTokens: 50,
      cacheWriteTokens: 10,
      outputTokens: 60,
      totalTokens: 420,
      toolCallCount: 3,
      model: 'claude-opus-4-5',
      models: ['claude-sonnet-4', 'claude-opus-4-5'],
    });
    expect(summary.usage?.toolCallBreakdown).toEqual({ Read: 2, Bash: 1 });
    expect(summary.title).toContain('帮我统计token');
  });
});

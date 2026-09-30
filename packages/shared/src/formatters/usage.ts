import type { AiTool } from '../contracts/common.js';
import type { UsageTotals } from '../contracts/statistics.js';

/**
 * Formats a raw token count into a compact human readable string.
 *
 * 小于 1 万时按千分位展示原始值；达到万/亿量级时缩写为「万」「亿」并保留最多两位小数，
 * 用于 PC 与移动端共享的展示口径。
 */
export function formatTokenCount(value?: number | null): string {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '0';
  if (numeric < 10_000) return numeric.toLocaleString('en-US');
  if (numeric < 100_000_000) return `${trimFraction(numeric / 10_000)}万`;
  return `${trimFraction(numeric / 100_000_000)}亿`;
}

/**
 * Splits total tokens into display segments (plain input / cache read / cache write / output).
 *
 * Codex 的 `inputTokens` 含缓存命中，需拆出非缓存输入；Claude 的 `inputTokens` 本身不含缓存。
 * 段顺序固定为：输入、缓存读、缓存写、输出。
 */
export function usageSegments(tool: AiTool, totals: UsageTotals): UsageTokenSegment[] {
  const cacheRead = Math.max(totals.cacheReadTokens || 0, 0);
  const cacheWrite = Math.max(totals.cacheWriteTokens || 0, 0);
  const output = Math.max(totals.outputTokens || 0, 0);
  const plainInput = tool === 'codex'
    ? Math.max((totals.inputTokens || 0) - cacheRead, 0)
    : Math.max(totals.inputTokens || 0, 0);
  return [
    { key: 'input', label: '输入', tokens: plainInput },
    { key: 'cacheRead', label: '缓存读', tokens: cacheRead },
    { key: 'cacheWrite', label: '缓存写', tokens: cacheWrite },
    { key: 'output', label: '输出', tokens: output },
  ];
}

/** 单个用量展示分段（纯数据，供比例条与图表共用）。 */
export interface UsageTokenSegment {
  key: 'input' | 'cacheRead' | 'cacheWrite' | 'output';
  label: string;
  tokens: number;
}

/**
 * Sorts a tool call breakdown into descending count pairs for display.
 */
export function sortToolCallBreakdown(breakdown?: Record<string, number>): Array<[string, number]> {
  return Object.entries(breakdown || {}).sort((a, b) => b[1] - a[1]);
}

/**
 * Rounds to two decimals and drops trailing zeros so `1.20` renders as `1.2`.
 */
function trimFraction(value: number): string {
  return String(Math.round(value * 100) / 100);
}

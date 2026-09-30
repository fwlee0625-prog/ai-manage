import type { UsageTokenSegment } from '@ai-manage/shared';

/**
 * 用量分段配色，与 `--ds-*` 设计令牌（info / brand-deep / warning / brand）保持一致，
 * 供 CSS 比例条与 ECharts 堆叠面积图共用。
 */
export const USAGE_SEGMENT_COLORS: Record<UsageTokenSegment['key'], string> = {
  input: '#3b82f6',
  cacheRead: '#57cc99',
  cacheWrite: '#f59e0b',
  output: '#aacc00',
};

/** 工具调用分布环形图的分类色板（超出部分循环使用）。 */
export const TOOL_CALL_CHART_PALETTE = [
  '#57cc99',
  '#3b82f6',
  '#aacc00',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#64748b',
  '#ec4899',
];

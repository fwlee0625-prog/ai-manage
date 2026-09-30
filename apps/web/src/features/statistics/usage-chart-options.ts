import { formatTokenCount, sortToolCallBreakdown, usageSegments } from '@ai-manage/shared';
import type { AiTool, DailyUsagePoint, UsageTokenSegment } from '@ai-manage/shared';
import type { EchartsOption } from './echarts-setup';
import { TOOL_CALL_CHART_PALETTE, USAGE_SEGMENT_COLORS } from './usage-palette';

/** 趋势图可选天数范围。 */
export const TREND_RANGE_OPTIONS = [14, 30, 90] as const;

/** 工具调用环形图最多展示的工具数，超出合并为「其他」。 */
const PIE_TOP_N = 10;

/** 趋势图堆叠序列（顺序与颜色映射 usage-palette 保持一致）。 */
const TREND_SERIES: Array<{ key: UsageTokenSegment['key']; label: string }> = [
  { key: 'input', label: '输入' },
  { key: 'cacheRead', label: '缓存读' },
  { key: 'cacheWrite', label: '缓存写' },
  { key: 'output', label: '输出' },
];

/**
 * 构建按日 Token 堆叠面积图配置（全局与项目作用域共用的纯函数）。
 *
 * @param points 按日用量数据点（升序）。
 * @param tool 当前 AI 工具，决定 Token 分段口径。
 */
export function buildTrendOption(points: DailyUsagePoint[], tool: AiTool): EchartsOption {
  const categories = points.map(point => point.date.slice(5));
  const seriesData: Record<UsageTokenSegment['key'], number[]> = {
    input: [],
    cacheRead: [],
    cacheWrite: [],
    output: [],
  };
  for (const point of points) {
    for (const segment of usageSegments(tool, point)) {
      seriesData[segment.key].push(segment.tokens);
    }
  }
  return {
    color: TREND_SERIES.map(series => USAGE_SEGMENT_COLORS[series.key]),
    tooltip: {
      trigger: 'axis',
      valueFormatter: value => formatTokenCount(Number(value)),
    },
    legend: { bottom: 0, icon: 'roundRect', itemHeight: 8, itemWidth: 12 },
    grid: { left: 8, right: 12, top: 24, bottom: 36, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: categories },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatTokenCount(value) } },
    series: TREND_SERIES.map(series => ({
      name: series.label,
      type: 'line',
      stack: 'tokens',
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.85 },
      emphasis: { focus: 'series' },
      data: seriesData[series.key],
    })),
  };
}

/**
 * 构建工具调用分布环形图配置（全局与项目作用域共用的纯函数）。
 *
 * @param breakdown 工具名 → 调用次数。
 */
export function buildToolCallOption(breakdown: Record<string, number>): EchartsOption {
  const entries = sortToolCallBreakdown(breakdown);
  const data = entries.slice(0, PIE_TOP_N).map(([name, value]) => ({ name, value }));
  const rest = entries.slice(PIE_TOP_N);
  if (rest.length) {
    data.push({ name: '其他', value: rest.reduce((sum, [, value]) => sum + value, 0) });
  }
  return {
    color: TOOL_CALL_CHART_PALETTE,
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} 次（{d}%）',
    },
    legend: { type: 'scroll', bottom: 0, icon: 'circle', itemHeight: 8, itemWidth: 8 },
    series: [
      {
        name: '工具调用',
        type: 'pie',
        radius: ['42%', '66%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1 },
        label: { show: false },
        data,
      },
    ],
  };
}

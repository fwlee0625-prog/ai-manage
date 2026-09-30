import { computed, onMounted, ref, watch } from 'vue';
import type { DailyUsagePoint, UsageOverview } from '@ai-manage/shared';
import { api } from '../../api';
import { refreshRevision, selectedTool } from '../../state/app-state';
import { runWithApiFeedback } from '../../shared/composables/use-api-feedback';
import { buildTrendOption, buildToolCallOption } from './usage-chart-options';

/**
 * 全局作用域的用量统计数据：全局总览卡片、按日 Token 趋势与工具调用分布。
 * 跟随左侧工具选择与索引刷新自动重载。
 */
export function useGlobalUsage() {
  const overview = ref<UsageOverview>();
  const daily = ref<DailyUsagePoint[]>([]);
  const trendDays = ref<number>(30);
  const loading = ref(false);

  /**
   * 旧索引没有用量列：有会话但数值全为 0 时提示先刷新索引。
   */
  const needsReindex = computed(() => {
    const current = overview.value;
    if (!current || current.sessionCount <= 0) return false;
    const { inputTokens, outputTokens, totalTokens, toolCallCount } = current.totals;
    return inputTokens === 0 && outputTokens === 0 && totalTokens === 0 && toolCallCount === 0;
  });

  /** 全局按日 Token 堆叠面积图配置。 */
  const trendOption = computed(() => buildTrendOption(daily.value, selectedTool.value));

  /** 全局工具调用分布环形图配置。 */
  const toolCallOption = computed(() => buildToolCallOption(overview.value?.toolCallBreakdown ?? {}));

  /** Loads the global overview (totals + tool call breakdown). */
  async function loadOverview() {
    overview.value = await api.statsOverview(selectedTool.value);
  }

  /** Loads the daily trend across all projects of the current tool. */
  async function loadDaily() {
    daily.value = await api.statsDaily({
      tool: selectedTool.value,
      days: trendDays.value,
    });
  }

  /** Reloads everything for the current tool. */
  async function reloadAll() {
    loading.value = true;
    try {
      await Promise.all([
        runWithApiFeedback(loadOverview),
        runWithApiFeedback(loadDaily),
      ]);
    } finally {
      loading.value = false;
    }
  }

  watch([selectedTool, refreshRevision], reloadAll);
  watch(trendDays, () => runWithApiFeedback(loadDaily));
  onMounted(reloadAll);

  return {
    overview,
    trendDays,
    loading,
    needsReindex,
    trendOption,
    toolCallOption,
  };
}

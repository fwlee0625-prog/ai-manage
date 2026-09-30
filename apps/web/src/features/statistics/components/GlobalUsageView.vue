<script setup lang="ts">
import { computed } from 'vue';
import { formatTokenCount } from '@ai-manage/shared';
import { DsMetricCard, DsPanel } from '../../../components/design-system';
import StatChart from './StatChart.vue';
import { useGlobalUsage } from '../use-global-usage';
import { TREND_RANGE_OPTIONS } from '../usage-chart-options';

/**
 * 全局作用域视图：Token 用量总览卡片、全部项目的按日趋势与工具调用分布。
 * 数据由 {@link useGlobalUsage} 自行加载，父组件仅负责作用域切换。
 */
const { overview, trendDays, loading, needsReindex, trendOption, toolCallOption } =
  useGlobalUsage();

const metrics = computed(() => {
  const totals = overview.value?.totals;
  return [
    { title: '项目数', value: overview.value?.projectCount ?? 0, description: '当前索引内的项目总数', accent: 'info' as const },
    { title: '会话数', value: overview.value?.sessionCount ?? 0, description: '参与统计的会话总数', accent: 'brand' as const },
    { title: '输入 Token', value: formatTokenCount(totals?.inputTokens), description: 'Claude 不含缓存；Codex 含缓存命中', accent: 'info' as const },
    { title: '缓存读', value: formatTokenCount(totals?.cacheReadTokens), description: '命中缓存的上下文读取量', accent: 'brand' as const },
    { title: '缓存写', value: formatTokenCount(totals?.cacheWriteTokens), description: '写入缓存的上下文量', accent: 'warning' as const },
    { title: '输出 Token', value: formatTokenCount(totals?.outputTokens), description: '模型输出（含推理）', accent: 'danger' as const },
    { title: '总 Token', value: formatTokenCount(totals?.totalTokens), description: 'Codex 官方累计；Claude 为四项之和', accent: 'brand' as const },
    { title: '工具调用', value: formatTokenCount(totals?.toolCallCount), description: 'function_call / tool_use 总次数', accent: 'warning' as const },
  ];
});
</script>

<template>
  <div v-loading="loading" class="global-usage-view">
    <DsPanel title="用量总览">
      <el-alert
        v-if="needsReindex"
        class="global-usage-view__alert"
        title="当前索引尚未包含用量数据"
        description="点击右上角「刷新索引」重新扫描会话文件后，即可看到 Token 与工具调用统计。"
        type="info"
        show-icon
        :closable="false"
      />
      <div class="global-usage-view__metrics">
        <DsMetricCard
          v-for="metric in metrics"
          :key="metric.title"
          :title="metric.title"
          :value="metric.value"
          :description="metric.description"
          :accent="metric.accent"
        />
      </div>
    </DsPanel>

    <div class="global-usage-view__charts">
      <DsPanel
        title="按日 Token 趋势"
        description="统计当前工具全部项目；会话用量按其最后更新时间归入当天"
      >
        <template #actions>
          <el-radio-group v-model="trendDays" size="small">
            <el-radio-button v-for="days in TREND_RANGE_OPTIONS" :key="days" :value="days">
              {{ days }} 天
            </el-radio-button>
          </el-radio-group>
        </template>
        <StatChart :option="trendOption" height="300px" />
      </DsPanel>
      <DsPanel title="工具调用分布" description="统计当前工具全部项目（Top 10）">
        <StatChart :option="toolCallOption" height="300px" />
      </DsPanel>
    </div>
  </div>
</template>

<style scoped lang="scss">
.global-usage-view {
  display: grid;
  gap: 16px;
  align-content: start;
}

.global-usage-view__alert {
  margin-bottom: 14px;
}

.global-usage-view__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.global-usage-view__charts {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 16px;
}

@media (max-width: 1400px) {
  .global-usage-view__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .global-usage-view__charts {
    grid-template-columns: 1fr;
  }
}
</style>

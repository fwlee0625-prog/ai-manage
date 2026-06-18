<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import type { ScanStatus } from '@ai-manage/shared';
import { DsMetricCard, DsPanel, DsStatusPill } from '../../components/design-system';
import { refreshRevision } from '../../state/app-state';
import { useOverview } from './use-overview';

const { toolStatus, loadTools, toolLabel, formatTime } = useOverview();
type MetricAccent = 'brand' | 'info' | 'warning' | 'danger';
interface OverviewCard {
  id: string;
  title: string;
  value: string;
  description: string;
  meta: string;
  accent: MetricAccent;
  tool: ScanStatus;
}

watch(refreshRevision, loadTools);
onMounted(loadTools);

const overviewCards = computed<OverviewCard[]>(() =>
  toolStatus.tools.map(tool => ({
    id: tool.tool,
    title: `${toolLabel(tool.tool)} 工具`,
    value: tool.available ? '在线' : '离线',
    description: tool.available ? '索引与扫描路径可用' : '工具路径暂不可用',
    meta: [
      `配置文件 ${tool.configFileCount}`,
      `会话索引 ${tool.sessionCount}`,
      `最后扫描 ${formatTime(tool.lastIndexedAt)}`,
    ].join(' · '),
    accent: tool.available ? 'info' : 'danger',
    tool,
  })),
);

const summary = computed(() => {
  const total = toolStatus.tools.length;
  const available = toolStatus.tools.filter(tool => tool.available).length;
  const configTotal = toolStatus.tools.reduce((sum, tool) => sum + tool.configFileCount, 0);
  const sessionTotal = toolStatus.tools.reduce((sum, tool) => sum + tool.sessionCount, 0);

  return {
    total,
    available,
    configTotal,
    sessionTotal,
  };
});
</script>

<template>
  <section class="overview-page">
    <DsPanel
      class="overview-hero"
      title="总览"
      description="本机 AI 工具配置、扫描状态与会话索引的统一入口"
    >
      <template #actions>
        <DsStatusPill tone="success">
          {{ summary.available }}/{{ summary.total }} 可用
        </DsStatusPill>
      </template>
      <div class="overview-stats">
        <DsMetricCard
          title="工具总数"
          :value="summary.total"
          description="当前接入的 AI 工具"
          accent="info"
        />
        <DsMetricCard
          title="可用工具"
          :value="summary.available"
          description="可扫描、可刷新、可展示状态"
          accent="brand"
        />
        <DsMetricCard
          title="配置文件"
          :value="summary.configTotal"
          description="配置项与文件索引总量"
          accent="warning"
        />
        <DsMetricCard
          title="会话索引"
          :value="summary.sessionTotal"
          description="聚合后的历史会话数量"
          accent="danger"
        />
      </div>
    </DsPanel>

    <section class="overview-grid">
      <DsMetricCard
        v-for="card in overviewCards"
        :key="card.id"
        :title="card.title"
        :value="card.value"
        :description="card.description"
        :meta="card.meta"
        :accent="card.accent"
      >
        <template #status>
          <DsStatusPill :tone="card.tool.available ? 'success' : 'danger'">
            {{ card.tool.available ? '可用' : '异常' }}
          </DsStatusPill>
        </template>
      </DsMetricCard>
    </section>

    <DsPanel title="工具详情" description="每个工具的根路径与最近扫描时间">
      <div class="tool-detail-list">
        <article v-for="tool in toolStatus.tools" :key="tool.tool" class="tool-detail">
          <header class="tool-detail__header">
            <strong>{{ toolLabel(tool.tool) }}</strong>
            <DsStatusPill :tone="tool.available ? 'success' : 'danger'">
              {{ tool.available ? '可用' : '不可用' }}
            </DsStatusPill>
          </header>
          <dl class="tool-detail__metrics">
            <div>
              <dt>配置文件</dt>
              <dd>{{ tool.configFileCount }}</dd>
            </div>
            <div>
              <dt>会话索引</dt>
              <dd>{{ tool.sessionCount }}</dd>
            </div>
          </dl>
          <p class="tool-detail__path mono">{{ tool.rootPath }}</p>
          <p class="tool-detail__time muted">最后扫描：{{ formatTime(tool.lastIndexedAt) }}</p>
          <el-alert v-if="tool.error" :title="tool.error" type="warning" show-icon :closable="false" />
        </article>
      </div>
    </DsPanel>
  </section>
</template>

<style scoped lang="scss">
.overview-page {
  display: grid;
  gap: 16px;
  min-height: 0;
}

.overview-hero {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 96%), rgb(248 251 255 / 90%)),
    var(--ds-gradient-page);
}

.overview-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.tool-detail-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.tool-detail {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface-soft);
}

.tool-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tool-detail__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 14px 0 0;
}

.tool-detail__metrics div {
  padding: 12px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface);
}

.tool-detail__metrics dt {
  color: var(--ds-color-text-muted);
  font-size: 12px;
}

.tool-detail__metrics dd {
  margin: 6px 0 0;
  color: var(--ds-color-text);
  font-size: 24px;
  font-weight: 800;
}

.tool-detail__path {
  margin: 12px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-detail__time {
  margin: 8px 0 0;
}

@media (max-width: 1400px) {
  .overview-stats,
  .overview-grid,
  .tool-detail-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

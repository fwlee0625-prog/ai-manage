<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { runtimeAuthModeLabel, runtimeSyncStatusLabel, type RuntimeSyncStatus } from '@ai-manage/shared';
import { DsMetricCard, DsPanel, DsStatusPill } from '../../components/design-system';
import { refreshRevision } from '../../state/app-state';
import { useOverview } from './use-overview';

const { toolStatus, runtimes, loadTools, toolLabel, formatTime } = useOverview();

watch(refreshRevision, loadTools);
onMounted(loadTools);

/** Maps a sync status to a status-pill tone; auth problems read as danger. */
function syncTone(status?: RuntimeSyncStatus): 'success' | 'warning' | 'danger' {
  if (status === 'synced') return 'success';
  if (status === 'auth_invalid' || status === 'reauth_required') return 'danger';
  return 'warning';
}

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
      title="当前运行环境"
      description="各工具当前生效的供应商、模型与账号快照，只消费 RuntimeSummary，不读取或拼装 live 配置"
    >
      <template #actions>
        <DsStatusPill :tone="summary.available === summary.total ? 'success' : 'warning'">
          {{ summary.available }}/{{ summary.total }} 工具可用
        </DsStatusPill>
      </template>
      <div class="runtime-overview-grid">
        <article v-for="tool in toolStatus.tools" :key="`runtime-${tool.tool}`" class="runtime-overview-card">
          <header class="runtime-overview-card__header">
            <div class="runtime-overview-card__id">
              <span>{{ toolLabel(tool.tool) }}</span>
              <strong>{{ runtimes[tool.tool]?.providerName || '未托管运行环境' }}</strong>
            </div>
            <DsStatusPill :tone="syncTone(runtimes[tool.tool]?.syncStatus)">
              {{ runtimeSyncStatusLabel(runtimes[tool.tool]?.syncStatus) }}
            </DsStatusPill>
          </header>
          <p class="runtime-overview-card__model mono">{{ runtimes[tool.tool]?.model || '未识别模型' }}</p>
          <dl class="runtime-overview-card__metrics">
            <div>
              <dt>认证方式</dt>
              <dd>{{ runtimeAuthModeLabel(runtimes[tool.tool]?.authMode) }}</dd>
            </div>
            <div>
              <dt>推理强度</dt>
              <dd>{{ runtimes[tool.tool]?.reasoningEffort || '-' }}</dd>
            </div>
            <div>
              <dt>账号</dt>
              <dd>{{ runtimes[tool.tool]?.accountSummary || '-' }}</dd>
            </div>
            <div>
              <dt>最后切换</dt>
              <dd>{{ formatTime(runtimes[tool.tool]?.lastSwitchedAt) }}</dd>
            </div>
          </dl>
          <p v-if="!tool.available" class="runtime-overview-card__warn muted">
            该工具当前离线，快照可能不可信
          </p>
        </article>
      </div>
    </DsPanel>

    <DsPanel title="索引概况" description="本机扫描索引的总量统计（不限当前选择的配置）">
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
  height: 100%;
  align-content: start;
  overflow: auto;
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

.runtime-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.runtime-overview-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface-soft);
}

.runtime-overview-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.runtime-overview-card__id { display: grid; gap: 4px; }
.runtime-overview-card__id span { color: var(--ds-color-text-muted); font-size: 12px; }
.runtime-overview-card__id strong { font-size: 16px; }

.runtime-overview-card__model {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.runtime-overview-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.runtime-overview-card__metrics div {
  padding: 10px 12px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface);
}

.runtime-overview-card__metrics dt {
  color: var(--ds-color-text-muted);
  font-size: 12px;
}

.runtime-overview-card__metrics dd {
  margin: 4px 0 0;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-overview-card__warn {
  margin: 0;
  font-size: 12px;
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
  .tool-detail-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

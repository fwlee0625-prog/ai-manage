<script setup lang="ts">
import { formatTokenCount, relativeTimeFromNow, usageSegments } from '@ai-manage/shared';
import type { ProjectUsageStats } from '@ai-manage/shared';
import { USAGE_SEGMENT_COLORS } from '../usage-palette';

/**
 * Scrollable project usage list: one selectable card per project with token
 * totals and a stacked composition bar (输入 / 缓存读 / 缓存写 / 输出)。
 */
defineProps<{
  projects: ProjectUsageStats[];
  selectedProjectPath: string;
}>();

const emit = defineEmits<{ select: [projectPath: string] }>();

/**
 * Computes percentage widths for the stacked composition bar, skipping empty
 * segments so zero-value pieces don't render slivers.
 */
function barSegments(project: ProjectUsageStats): Array<{ key: 'input' | 'cacheRead' | 'cacheWrite' | 'output'; width: number }> {
  const total = project.usage.totalTokens || 0;
  if (total <= 0) return [];
  return usageSegments(project.tool, project.usage)
    .filter(segment => segment.tokens > 0)
    .map(segment => ({ key: segment.key, width: (segment.tokens / total) * 100 }));
}
</script>

<template>
  <div class="project-usage-list">
    <button
      v-for="project in projects"
      :key="`${project.tool}:${project.projectPath}`"
      type="button"
      class="project-usage-item"
      :class="{ 'project-usage-item--active': project.projectPath === selectedProjectPath }"
      @click="emit('select', project.projectPath)"
    >
      <header class="project-usage-item__header">
        <span class="project-usage-item__name" :title="project.projectPath">{{ project.projectName }}</span>
        <el-tag size="small" :type="project.tool === 'codex' ? 'primary' : 'success'">{{ project.tool }}</el-tag>
      </header>
      <dl class="project-usage-item__metrics">
        <div><dt>会话</dt><dd>{{ project.sessionCount }}</dd></div>
        <div><dt>输入</dt><dd>{{ formatTokenCount(project.usage.inputTokens) }}</dd></div>
        <div><dt>输出</dt><dd>{{ formatTokenCount(project.usage.outputTokens) }}</dd></div>
        <div><dt>工具调用</dt><dd>{{ formatTokenCount(project.usage.toolCallCount) }}</dd></div>
      </dl>
      <div v-if="barSegments(project).length" class="project-usage-item__bar" aria-hidden="true">
        <span
          v-for="segment in barSegments(project)"
          :key="segment.key"
          class="project-usage-item__bar-segment"
          :style="{ width: `${segment.width}%`, background: USAGE_SEGMENT_COLORS[segment.key] }"
        ></span>
      </div>
      <footer class="project-usage-item__footer">
        <span>共 {{ formatTokenCount(project.usage.totalTokens) }} tokens</span>
        <span>{{ relativeTimeFromNow(project.latestUpdatedAt) }}</span>
      </footer>
    </button>
    <el-empty v-if="!projects.length" description="暂无项目数据，请先刷新索引" />
  </div>
</template>

<style scoped lang="scss">
.project-usage-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.project-usage-item {
  display: grid;
  flex: 0 0 auto;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface-soft);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: var(--ds-color-brand-deep);
    box-shadow: var(--ds-shadow-hover);
  }

  &--active {
    border-color: var(--ds-color-brand-deep);
    background: var(--ds-color-action-soft);
    box-shadow: var(--ds-shadow-hover);
  }
}

.project-usage-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.project-usage-item__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-usage-item__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;

  div {
    min-width: 0;
  }

  dt {
    color: var(--ds-color-text-muted);
    font-size: 12px;
  }

  dd {
    margin: 2px 0 0;
    overflow: hidden;
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.project-usage-item__bar {
  display: flex;
  gap: 2px;
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--ds-color-border-soft);
}

.project-usage-item__bar-segment {
  height: 100%;
  min-width: 2px;
}

.project-usage-item__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--ds-color-text-muted);
  font-size: 12px;
}
</style>

<script setup lang="ts">
import { formatTokenCount, relativeTimeFromNow } from '@ai-manage/shared';
import type { SessionSummary } from '@ai-manage/shared';

/**
 * 会话级用量表格：每个会话一行，模型列展示会话中使用过的全部模型。
 */
defineProps<{
  sessions: SessionSummary[];
  loading?: boolean;
}>();

/** Numeric fields of {@link SessionUsage} exposed as sortable columns. */
type UsageField =
  | 'inputTokens'
  | 'cacheReadTokens'
  | 'cacheWriteTokens'
  | 'outputTokens'
  | 'totalTokens'
  | 'toolCallCount';

/** Formats a usage cell, falling back to `-` when the row has no usage data. */
function usageText(row: SessionSummary, field: UsageField): string {
  return row.usage ? formatTokenCount(row.usage[field]) : '-';
}

/** 模型列文案：会话切换过多个模型时按顺序用「、」全部展示。 */
function modelText(row: SessionSummary): string {
  if (!row.usage) return '-';
  const models = row.usage.models?.length ? row.usage.models : row.usage.model ? [row.usage.model] : [];
  return models.length ? models.join('、') : '-';
}

/** Sortable token column configs shared by the loop below. */
const usageColumns: Array<{ key: UsageField; label: string; width: number }> = [
  { key: 'inputTokens', label: '输入', width: 100 },
  { key: 'cacheReadTokens', label: '缓存读', width: 100 },
  { key: 'cacheWriteTokens', label: '缓存写', width: 100 },
  { key: 'outputTokens', label: '输出', width: 100 },
  { key: 'totalTokens', label: '总 Token', width: 110 },
  { key: 'toolCallCount', label: '工具调用', width: 100 },
];
</script>

<template>
  <el-table
    v-loading="loading"
    class="session-usage-table"
    :data="sessions"
    height="100%"
    size="small"
  >
    <el-table-column prop="title" label="会话" min-width="200" show-overflow-tooltip />
    <el-table-column label="模型" min-width="150" show-overflow-tooltip>
      <template #default="{ row }">{{ modelText(row) }}</template>
    </el-table-column>
    <el-table-column prop="messageCount" label="消息" width="80" sortable />
    <el-table-column
      v-for="field in usageColumns"
      :key="field.key"
      :prop="`usage.${field.key}`"
      :label="field.label"
      :width="field.width"
      sortable
    >
      <template #default="{ row }">{{ usageText(row, field.key) }}</template>
    </el-table-column>
    <el-table-column label="更新时间" width="110">
      <template #default="{ row }">{{ relativeTimeFromNow(row.updatedAt) }}</template>
    </el-table-column>
    <template #empty>
      <el-empty description="暂无会话数据" />
    </template>
  </el-table>
</template>

<style scoped lang="scss">
.session-usage-table {
  flex: 1;
  min-height: 0;
}
</style>

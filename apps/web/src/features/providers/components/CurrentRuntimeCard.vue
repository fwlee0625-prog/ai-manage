<script setup lang="ts">
import { computed } from 'vue';
import type { RuntimeSummary } from '@ai-manage/shared';

const props = defineProps<{ runtime?: RuntimeSummary; loading?: boolean }>();
defineEmits<{ refresh: []; adopt: []; restore: [] }>();

const statusLabel = computed(() => ({
  synced: '已同步',
  externally_modified: '检测到外部修改',
  unmanaged: '未托管',
  auth_invalid: '认证无效',
  reauth_required: '需要重新认证',
}[props.runtime?.syncStatus || 'unmanaged']));

const statusType = computed(() => {
  if (props.runtime?.syncStatus === 'synced') return 'success';
  if (props.runtime?.syncStatus === 'auth_invalid' || props.runtime?.syncStatus === 'reauth_required') return 'danger';
  return 'warning';
});
</script>

<template>
  <section class="runtime-card">
    <div>
      <span class="eyebrow">当前运行环境</span>
      <h2>{{ runtime?.providerName || '未识别 Provider' }}</h2>
      <p>
        {{ runtime?.model || '未识别模型' }}
        · {{ runtime?.authMode || '认证未知' }}
        <template v-if="runtime?.accountSummary"> · {{ runtime.accountSummary }}</template>
      </p>
      <p v-if="runtime?.lastSwitchedAt" class="runtime-card__time">最后切换：{{ runtime.lastSwitchedAt }}</p>
    </div>
    <div class="runtime-card__status">
      <el-tag :type="statusType">{{ statusLabel }}</el-tag>
      <el-button
        v-if="runtime?.syncStatus === 'externally_modified' || runtime?.syncStatus === 'unmanaged'"
        size="small"
        @click="$emit('adopt')"
      >
        采用当前状态
      </el-button>
      <el-button
        v-if="runtime?.managedProviderId && runtime?.syncStatus !== 'synced'"
        size="small"
        type="primary"
        plain
        @click="$emit('restore')"
      >
        恢复 AI Manage 配置
      </el-button>
      <el-button size="small" :loading="loading" @click="$emit('refresh')">刷新</el-button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.runtime-card { display: flex; justify-content: space-between; gap: 16px; padding: 18px; border: 1px solid var(--ds-color-border-soft); border-radius: var(--ds-radius-feature); background: var(--ds-color-surface); }
.eyebrow { color: var(--ds-color-text-muted); font-size: 12px; }
.runtime-card h2 { margin: 6px 0; }
.runtime-card p { margin: 0; color: var(--ds-color-text-muted); }
.runtime-card__time { margin-top: 6px !important; font-size: 12px; }
.runtime-card__status { display: flex; align-items: flex-start; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
</style>

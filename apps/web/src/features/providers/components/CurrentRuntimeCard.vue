<script setup lang="ts">
import type { RuntimeSummary } from '@ai-manage/shared';
defineProps<{ runtime?: RuntimeSummary; loading?: boolean }>();
defineEmits<{ refresh: [] }>();
</script>
<template>
  <section class="runtime-card">
    <div>
      <span class="eyebrow">当前运行环境</span>
      <h2>{{ runtime?.providerName || '未识别 Provider' }}</h2>
      <p>{{ runtime?.model || '未识别模型' }} · {{ runtime?.authMode || '认证未知' }}</p>
    </div>
    <div class="runtime-card__status">
      <el-tag :type="runtime?.syncStatus === 'synced' ? 'success' : 'warning'">
        {{ runtime?.syncStatus || '加载中' }}
      </el-tag>
      <el-button size="small" :loading="loading" @click="$emit('refresh')">刷新</el-button>
    </div>
  </section>
</template>
<style scoped lang="scss">
.runtime-card{display:flex;justify-content:space-between;gap:16px;padding:18px;border:1px solid var(--ds-color-border-soft);border-radius:var(--ds-radius-feature);background:var(--ds-color-surface)}
.eyebrow{color:var(--ds-color-text-muted);font-size:12px}.runtime-card h2{margin:6px 0}.runtime-card p{margin:0;color:var(--ds-color-text-muted)}.runtime-card__status{display:flex;align-items:flex-start;gap:8px}
</style>

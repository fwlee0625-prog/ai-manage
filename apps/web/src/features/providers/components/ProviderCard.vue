<script setup lang="ts">
import type { AiProviderProfile, ProviderHealthStatus } from '@ai-manage/shared';

defineProps<{
  provider: AiProviderProfile;
  active?: boolean;
  switching?: boolean;
  healthStatus?: ProviderHealthStatus;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}>();
defineEmits<{ switch: []; edit: []; duplicate: []; test: []; remove: []; moveUp: []; moveDown: [] }>();

function healthLabel(status: ProviderHealthStatus = 'unknown') {
  return {
    unknown: '未检测',
    healthy: '健康',
    auth_error: '认证异常',
    unreachable: '不可达',
    invalid_config: '配置异常',
  }[status];
}
function healthType(status: ProviderHealthStatus = 'unknown'): 'success' | 'info' | 'warning' {
  if (status === 'healthy') return 'success';
  if (status === 'unknown') return 'info';
  return 'warning';
}
</script>

<template>
  <article class="provider-card" :class="{ 'provider-card--active': active }">
    <header>
      <div><h3>{{ provider.name }}</h3><p>{{ provider.providerType }}</p></div>
      <div class="provider-card__tags">
        <el-tag :type="healthType(healthStatus)" size="small">{{ healthLabel(healthStatus) }}</el-tag>
        <el-tag v-if="active" type="success">当前</el-tag>
      </div>
    </header>
    <dl>
      <div><dt>模型</dt><dd>{{ provider.defaultModel || '未配置' }}</dd></div>
      <div><dt>Endpoint</dt><dd class="mono">{{ provider.endpoint || '默认' }}</dd></div>
      <div><dt>认证</dt><dd>{{ provider.authMode }} · {{ provider.credential?.configured ? '凭据已配置' : '无托管凭据' }}</dd></div>
    </dl>
    <footer>
      <el-button size="small" :disabled="!canMoveUp" @click="$emit('moveUp')">上移</el-button>
      <el-button size="small" :disabled="!canMoveDown" @click="$emit('moveDown')">下移</el-button>
      <el-button size="small" @click="$emit('edit')">编辑</el-button>
      <el-button size="small" @click="$emit('test')">测试</el-button>
      <el-dropdown>
        <el-button size="small">更多</el-button>
        <template #dropdown><el-dropdown-menu>
          <el-dropdown-item @click="$emit('duplicate')">复制</el-dropdown-item>
          <el-dropdown-item divided @click="$emit('remove')">删除</el-dropdown-item>
        </el-dropdown-menu></template>
      </el-dropdown>
      <el-button size="small" type="primary" :disabled="active" :loading="switching" @click="$emit('switch')">切换</el-button>
    </footer>
  </article>
</template>

<style scoped lang="scss">
.provider-card{display:flex;flex-direction:column;gap:14px;padding:16px;border:1px solid var(--ds-color-border-soft);border-radius:var(--ds-radius-control);background:var(--ds-color-surface)}
.provider-card--active{border-color:var(--ds-state-active-border)}header,footer{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}h3{margin:0}header p{margin:4px 0 0;color:var(--ds-color-text-muted);font-size:12px}.provider-card__tags{display:flex;gap:6px;align-items:center}dl{display:grid;gap:8px;margin:0}dl div{display:grid;grid-template-columns:74px 1fr;gap:8px}dt{color:var(--ds-color-text-muted);font-size:12px}dd{margin:0;overflow-wrap:anywhere;font-size:12px}footer{margin-top:auto;justify-content:flex-end;flex-wrap:wrap}
</style>

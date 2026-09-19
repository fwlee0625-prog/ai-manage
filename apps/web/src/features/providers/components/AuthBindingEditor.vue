<script setup lang="ts">
import type { ProviderAuthMode } from '@ai-manage/shared';

defineProps<{ modelValue: ProviderAuthMode; credentialConfigured?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: ProviderAuthMode] }>();

/** Narrows Element Plus select values to the provider auth contract. */
function updateAuthMode(value: string) {
  emit('update:modelValue', value as ProviderAuthMode);
}
</script>

<template>
  <div>
    <el-select :model-value="modelValue" @update:model-value="updateAuthMode">
      <el-option label="API Key" value="api_key" />
      <el-option label="跟随原生登录" value="native_login" />
      <el-option label="无认证" value="none" />
      <el-option label="托管账号（Phase 4）" value="managed_account" disabled />
    </el-select>
    <p v-if="credentialConfigured">当前凭据：已配置（不会从服务端回显）</p>
  </div>
</template>

<style scoped>
p { margin: 6px 0 0; color: #909399; font-size: 12px; }
</style>

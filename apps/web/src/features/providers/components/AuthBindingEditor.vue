<script setup lang="ts">
import type { ManagedAccount, ProviderAuthMode } from '@ai-manage/shared';

const props = defineProps<{
  modelValue: ProviderAuthMode;
  accountId?: string;
  accounts: ManagedAccount[];
  allowManagedAccount?: boolean;
  credentialConfigured?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: ProviderAuthMode];
  'update:accountId': [value: string];
  addAccount: [];
}>();

/** Narrows Element Plus select values to the provider auth contract. */
function updateAuthMode(value: string) {
  emit('update:modelValue', value as ProviderAuthMode);
}

/** Emits the selected stable local account UUID. */
function updateAccountId(value: string) {
  emit('update:accountId', value);
}
</script>

<template>
  <div class="auth-editor">
    <el-select :model-value="modelValue" @update:model-value="updateAuthMode">
      <el-option label="API Key" value="api_key" />
      <el-option label="跟随原生登录" value="native_login" />
      <el-option label="无认证" value="none" />
      <el-option label="托管 ChatGPT 账号" value="managed_account" :disabled="!allowManagedAccount" />
    </el-select>

    <template v-if="modelValue === 'managed_account'">
      <div class="account-select">
        <el-select :model-value="accountId" placeholder="选择 ChatGPT 账号" @update:model-value="updateAccountId">
          <el-option
            v-for="account in accounts"
            :key="account.id"
            :label="account.displayName || account.email || account.id"
            :value="account.id"
            :disabled="account.status !== 'active'"
          />
        </el-select>
        <el-button @click="emit('addAccount')">账号中心</el-button>
      </div>
      <p v-if="!accounts.length">请先添加 ChatGPT 账号。</p>
    </template>

    <p v-if="credentialConfigured && modelValue === 'api_key'">当前凭据：已配置（不会从服务端回显）</p>
  </div>
</template>

<style scoped>
.auth-editor { display: grid; gap: 8px; }
.account-select { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
p { margin: 0; color: #909399; font-size: 12px; }
</style>

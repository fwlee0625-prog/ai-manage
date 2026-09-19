<script setup lang="ts">
import type { ManagedAccount } from '@ai-manage/shared';
import AccountCard from './AccountCard.vue';

const visible = defineModel<boolean>('visible', { required: true });
defineProps<{ accounts: ManagedAccount[] }>();
defineEmits<{ add: []; reauth: [account: ManagedAccount]; setDefault: [account: ManagedAccount]; remove: [account: ManagedAccount] }>();
</script>

<template>
  <el-drawer v-model="visible" title="ChatGPT 账号中心" size="560px">
    <div class="account-center">
      <div class="account-center__intro">
        <p>账号身份与 Provider 分离。Provider 通过账号绑定选择使用哪个 ChatGPT OAuth 身份。</p>
        <el-button type="primary" @click="$emit('add')">添加账号</el-button>
      </div>
      <div v-if="accounts.length" class="account-list">
        <AccountCard
          v-for="account in accounts"
          :key="account.id"
          :account="account"
          @reauth="$emit('reauth', account)"
          @set-default="$emit('setDefault', account)"
          @remove="$emit('remove', account)"
        />
      </div>
      <el-empty v-else description="还没有托管 ChatGPT 账号" />
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
.account-center { display: flex; flex-direction: column; gap: 14px; }
.account-center__intro { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.account-center__intro p { margin: 0; color: #606266; font-size: 13px; line-height: 1.6; }
.account-list { display: grid; gap: 12px; }
</style>

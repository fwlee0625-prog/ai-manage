<script setup lang="ts">
import type { ManagedAccount } from '@ai-manage/shared';

defineProps<{ account: ManagedAccount }>();
defineEmits<{ reauth: []; setDefault: []; remove: [] }>();
</script>

<template>
  <article class="account-card">
    <header>
      <div>
        <h3>{{ account.displayName || account.email || 'ChatGPT Account' }}</h3>
        <p>{{ account.email || account.identitySubject || account.id }}</p>
      </div>
      <div class="tags">
        <el-tag v-if="account.isDefault" type="success">默认</el-tag>
        <el-tag :type="account.status === 'active' ? 'info' : 'warning'">{{ account.status }}</el-tag>
      </div>
    </header>
    <dl>
      <div><dt>Workspace</dt><dd class="mono">{{ account.externalAccountId || '未提供' }}</dd></div>
      <div><dt>最近认证</dt><dd>{{ account.authenticatedAt || '未知' }}</dd></div>
    </dl>
    <footer>
      <el-button v-if="!account.isDefault" size="small" @click="$emit('setDefault')">设为默认</el-button>
      <el-button size="small" @click="$emit('reauth')">重新认证</el-button>
      <el-button size="small" type="danger" plain @click="$emit('remove')">删除</el-button>
    </footer>
  </article>
</template>

<style scoped lang="scss">
.account-card { display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
header, footer { display: flex; justify-content: space-between; gap: 8px; }
h3 { margin: 0; font-size: 15px; }
header p { margin: 4px 0 0; color: #909399; font-size: 12px; }
.tags, footer { display: flex; align-items: flex-start; gap: 8px; }
dl { display: grid; gap: 8px; margin: 0; }
dl div { display: grid; grid-template-columns: 78px 1fr; gap: 8px; }
dt { color: #909399; font-size: 12px; }
dd { margin: 0; overflow-wrap: anywhere; font-size: 12px; }
footer { justify-content: flex-end; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
</style>

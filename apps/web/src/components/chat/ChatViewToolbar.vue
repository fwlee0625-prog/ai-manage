<template>
  <div class="chat-toolbar">
    <el-radio-group :model-value="mode" size="small" @change="handleModeChange">
      <el-radio-button value="chat">对话视图</el-radio-button>
      <el-radio-button value="raw">原文视图</el-radio-button>
    </el-radio-group>

    <el-checkbox-group :model-value="visibleRoles" size="small" class="role-filter" @change="handleRolesChange">
      <el-checkbox-button v-for="role in chatMessageRoles" :key="role" :value="role">
        {{ chatRoleLabels[role] }}
      </el-checkbox-button>
    </el-checkbox-group>
  </div>
</template>

<script setup lang="ts">
import { chatMessageRoles, chatRoleLabels } from './message';
import type { ChatDisplayMode, ChatMessageRole } from './types';

defineProps<{
  mode: ChatDisplayMode;
  visibleRoles: ChatMessageRole[];
}>();

const emit = defineEmits<{
  'update:mode': [value: ChatDisplayMode];
  'update:visibleRoles': [value: ChatMessageRole[]];
}>();

function handleModeChange(value: string | number | boolean | undefined) {
  emit('update:mode', value === 'raw' ? 'raw' : 'chat');
}

function handleRolesChange(value: unknown) {
  const nextRoles = Array.isArray(value)
    ? value.filter((role): role is ChatMessageRole => chatMessageRoles.includes(role as ChatMessageRole))
    : [];
  emit('update:visibleRoles', nextRoles.length ? nextRoles : ['user', 'assistant']);
}
</script>

<style scoped>
.chat-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.role-filter {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0;
}
</style>

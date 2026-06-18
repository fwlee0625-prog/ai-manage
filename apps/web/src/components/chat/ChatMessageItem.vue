<template>
  <article class="chat-message" :class="[`role-${message.role}`, { 'raw-mode': mode === 'raw' }]">
    <header class="message-meta">
      <el-tag size="small" :type="tagType">{{ chatRoleLabels[message.role] }}</el-tag>
      <span class="original-role">{{ message.originalRole }}</span>
      <span class="message-time">{{ formatChatTime(message.timestamp) }}</span>
    </header>

    <div v-if="mode === 'chat'" class="message-bubble">
      <div class="markdown-body" v-html="displayHtml"></div>
    </div>
    <pre v-else class="raw-block">{{ displayText }}</pre>

    <button v-if="isLong" type="button" class="content-toggle" @click="$emit('toggle')">
      {{ expanded ? '收起内容' : '展开完整内容' }}
    </button>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from './markdown';
import { chatRoleLabels, formatChatTime } from './message';
import type { ChatDisplayMode, ChatMessageRole, ChatMessageViewModel } from './types';

const props = defineProps<{
  message: ChatMessageViewModel;
  mode: ChatDisplayMode;
  expanded: boolean;
}>();

defineEmits<{
  toggle: [];
}>();

const chatPreviewLimit = 1800;
const rawPreviewLimit = 3600;

const sourceText = computed(() => props.mode === 'raw' ? props.message.rawText : props.message.content);
const previewLimit = computed(() => props.mode === 'raw' ? rawPreviewLimit : chatPreviewLimit);
const isLong = computed(() => sourceText.value.length > previewLimit.value);
const displayText = computed(() => {
  if (!isLong.value || props.expanded) return sourceText.value;
  return `${sourceText.value.slice(0, previewLimit.value)}\n\n...`;
});
const displayHtml = computed(() => renderMarkdown(displayText.value));

const tagType = computed(() => {
  const tagTypes: Partial<Record<ChatMessageRole, 'success' | 'primary' | 'warning' | 'info' | 'danger'>> = {
    user: 'primary',
    assistant: 'success',
    system: 'warning',
    tool: 'info',
    event: 'info',
    unknown: 'danger',
  };
  return tagTypes[props.message.role] || 'info';
});
</script>

<style scoped>
.chat-message {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
}

.message-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  color: #8a93a3;
  font-size: 12px;
}

.role-user .message-meta {
  justify-content: flex-end;
}

.original-role {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-time {
  white-space: nowrap;
}

.message-bubble {
  max-width: min(760px, 86%);
  padding: 12px 14px;
  border: 1px solid #dfe7f2;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2937;
}

.role-user .message-bubble {
  align-self: flex-end;
  border-color: #b9d7ff;
  background: #eaf3ff;
}

.role-assistant .message-bubble {
  align-self: flex-start;
  border-color: #d7eadc;
  background: #f5fbf6;
}

.role-system .message-bubble,
.role-tool .message-bubble,
.role-event .message-bubble,
.role-unknown .message-bubble {
  max-width: 100%;
  border-style: dashed;
  background: #f8fafc;
  color: #4b5563;
}

pre {
  margin: 0;
  overflow: hidden;
  font-family:
    "SFMono-Regular",
    Consolas,
    "Liberation Mono",
    monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.raw-block {
  padding: 12px;
  border: 1px solid #d8dee9;
  border-radius: 6px;
  background: #0f172a;
  color: #e5e7eb;
}

.content-toggle {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 12px;
}

.role-user .content-toggle {
  align-self: flex-end;
}

.markdown-body {
  font-size: 13px;
  line-height: 1.65;
  word-break: break-word;
}

.markdown-body :deep(*) {
  max-width: 100%;
}

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(pre),
.markdown-body :deep(table) {
  margin: 0 0 10px;
}

.markdown-body :deep(*:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 12px 0 8px;
  color: #111827;
  font-size: 15px;
  line-height: 1.45;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
}

.markdown-body :deep(li + li) {
  margin-top: 4px;
}

.markdown-body :deep(code) {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.08);
  font-family:
    "SFMono-Regular",
    Consolas,
    "Liberation Mono",
    monospace;
  font-size: 12px;
}

.markdown-body :deep(.md-code) {
  overflow: auto;
  padding: 10px;
  border: 1px solid #d8dee9;
  border-radius: 6px;
  background: #0f172a;
  color: #e5e7eb;
}

.markdown-body :deep(.md-code code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.markdown-body :deep(blockquote) {
  padding-left: 10px;
  border-left: 3px solid #d4dbe8;
  color: #5f6b7a;
}

.markdown-body :deep(a) {
  color: #0b63ce;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(.md-table-wrap) {
  max-width: 100%;
  margin-bottom: 10px;
  overflow: auto;
}

.markdown-body :deep(table) {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 6px 8px;
  border: 1px solid #d8dee9;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #f3f6fb;
  font-weight: 600;
}
</style>

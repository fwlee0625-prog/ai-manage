<script setup lang="ts">
import type { McpServerSummary } from '../use-mcp-servers';

const props = defineProps<{
  /** MCP server summary rendered by this card. */
  server: McpServerSummary;
  /** Human readable tool label. */
  toolLabel: string;
  /** Human readable connection kind label. */
  kindLabel: string;
  /** Element Plus tag type for the connection kind. */
  kindTagType: 'success' | 'warning' | 'info';
}>();

const emit = defineEmits<{
  select: [serverId: string];
}>();

/**
 * Emits the selected MCP server id to the parent list.
 */
function selectServer() {
  emit('select', props.server.id);
}

/**
 * Keeps keyboard activation available while using a div container.
 */
function handleKeyboardSelect(event: KeyboardEvent) {
  event.preventDefault();
  selectServer();
}
</script>

<template>
  <div
    class="mcp-server-card"
    role="button"
    tabindex="0"
    @click="selectServer"
    @keydown.enter="handleKeyboardSelect"
    @keydown.space="handleKeyboardSelect"
  >
    <span class="mcp-server-card__main">
      <strong>{{ server.name }}</strong>
      <small>{{ server.commandPreview }}</small>
    </span>
    <span class="mcp-server-card__meta">
      <span class="mcp-server-card__path">{{ server.configName }}</span>
      <span class="mcp-server-card__tags">
        <el-tag
          size="small"
          :type="server.tool === 'codex' ? 'primary' : 'success'"
        >
          {{ toolLabel }}
        </el-tag>
        <el-tag size="small" :type="kindTagType">
          {{ kindLabel }}
        </el-tag>
      </span>
    </span>
  </div>
</template>

<style scoped lang="scss">
.mcp-server-card {
  display: flex;
  min-height: 154px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  box-sizing: border-box;
  width: 100%;
  padding: 14px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface);
  color: var(--ds-color-text);
  cursor: pointer;
  text-align: left;

  &:hover,
  &:focus-visible {
    border-color: var(--ds-state-active-border);
    background: var(--ds-state-active-bg);
    outline: none;
  }
}

.mcp-server-card__main {
  display: flex;
  min-width: 0;
  width: 100%;
  flex-direction: column;
  gap: 8px;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--ds-color-text-muted);
    display: -webkit-box;
    line-height: 1.5;
    white-space: normal;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

.mcp-server-card__meta {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.mcp-server-card__path {
  min-width: 0;
  overflow: hidden;
  color: var(--ds-color-text-muted);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mcp-server-card__tags {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
}
</style>

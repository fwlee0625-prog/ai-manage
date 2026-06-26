<script setup lang="ts">
import { Close } from '@element-plus/icons-vue';
import { nextTick, shallowReactive, shallowRef, useTemplateRef } from 'vue';
import ConfigObjectEditor from '../../components/config/ConfigObjectEditor.vue';
import McpServerCard from './components/McpServerCard.vue';
import { useMcpServers } from './use-mcp-servers';

const {
  servers,
  filteredServers,
  selectedServer,
  draftServer,
  serverFilter,
  mcpFilterOptions,
  loadingList,
  saving,
  isDirty,
  loadMcpServers,
  selectServer,
  resetDraft,
  saveServer,
  mcpFieldMeta,
  toolLabel,
  kindLabel,
  kindTagType,
} = useMcpServers();

interface DropdownExpose {
  handleClose: () => void;
  handleOpen: () => void;
}

const serverDrawerVisible = shallowRef(false);
const serverContextDropdownRef = useTemplateRef<DropdownExpose>(
  'serverContextDropdown',
);
const serverContextMenuPosition = shallowReactive({ x: 0, y: 0 });
const serverContextVirtualRef = {
  getBoundingClientRect: () =>
    new DOMRect(serverContextMenuPosition.x, serverContextMenuPosition.y, 0, 0),
};

/**
 * Opens the side drawer and loads the selected MCP server draft.
 */
function openServerDrawer(serverId: string) {
  serverDrawerVisible.value = true;
  selectServer(serverId);
}

/**
 * Opens the card-area context menu at the pointer position.
 */
async function openServerContextMenu(event: MouseEvent) {
  serverContextMenuPosition.x = event.clientX;
  serverContextMenuPosition.y = event.clientY;
  serverContextDropdownRef.value?.handleClose();
  await nextTick();
  serverContextDropdownRef.value?.handleOpen();
}

/**
 * Handles card-area context menu actions.
 */
function handleServerContextCommand(command: string | number | object) {
  if (command === 'refresh') void loadMcpServers();
}
</script>

<template>
  <section class="mcp-servers-page">
    <header class="mcp-toolbar">
      <el-segmented v-model="serverFilter" :options="mcpFilterOptions" />
      <span class="mcp-toolbar__count">
        {{ filteredServers.length }} / {{ servers.length }}
      </span>
    </header>

    <div
      class="mcp-card-context"
      @contextmenu.stop.prevent="openServerContextMenu"
    >
      <el-scrollbar class="mcp-card-scroll">
        <div v-loading="loadingList" class="mcp-list">
          <div class="mcp-card-grid">
            <McpServerCard
              v-for="server in filteredServers"
              :key="server.id"
              :server="server"
              :tool-label="toolLabel(server.tool)"
              :kind-label="kindLabel(server.kind)"
              :kind-tag-type="kindTagType(server.kind)"
              @select="openServerDrawer"
            />
          </div>
        </div>
        <el-empty
          v-if="!filteredServers.length && !loadingList"
          description="暂无 MCP 服务器"
        />
      </el-scrollbar>
    </div>

    <el-dropdown
      ref="serverContextDropdown"
      placement="right-start"
      trigger="contextmenu"
      virtual-triggering
      :virtual-ref="serverContextVirtualRef"
      :show-arrow="false"
      popper-class="mcp-context-menu"
      @command="handleServerContextCommand"
    >
      <span class="mcp-context-trigger" aria-hidden="true"></span>

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="refresh" :disabled="loadingList">
            刷新
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-drawer
      v-model="serverDrawerVisible"
      class="mcp-drawer"
      direction="rtl"
      size="58%"
      :with-header="false"
    >
      <section
        v-if="selectedServer"
        class="mcp-drawer__content"
      >
        <header class="mcp-drawer__header">
          <div class="mcp-drawer__heading">
            <span class="mcp-drawer__kicker">MCP Server</span>
            <h2>{{ selectedServer.name }}</h2>
            <p>{{ selectedServer.commandPreview }}</p>
          </div>
        </header>

        <div class="mcp-info">
          <section class="mcp-info__item">
            <span>来源</span>
            <strong>{{ toolLabel(selectedServer.tool) }}</strong>
          </section>
          <section class="mcp-info__item">
            <span>连接</span>
            <strong>{{ kindLabel(selectedServer.kind) }}</strong>
          </section>
          <section class="mcp-info__item mcp-info__item--wide">
            <span>配置文件</span>
            <p class="mono">{{ selectedServer.configPath }}</p>
          </section>
        </div>

        <div class="mcp-editor">
          <div class="mcp-editor__label">
            <span>服务器配置</span>
            <small>编辑后保存到对应配置文件的 mcp_servers 项</small>
          </div>
          <ConfigObjectEditor
            :model-value="draftServer"
            :path="[selectedServer.tool, 'mcp_servers', selectedServer.name]"
            :field-meta="mcpFieldMeta"
            @update:model-value="draftServer = $event"
          />
        </div>

        <footer class="mcp-drawer__footer">
          <el-tag v-if="isDirty" size="small" type="warning">未保存</el-tag>
          <div class="detail-actions">
            <el-button @click="resetDraft">撤销修改</el-button>
            <el-button
              type="primary"
              :disabled="!isDirty"
              :loading="saving"
              @click="saveServer"
            >
              保存服务器
            </el-button>
            <el-button
              :icon="Close"
              circle
              title="关闭详情"
              @click="serverDrawerVisible = false"
            />
          </div>
        </footer>
      </section>

      <el-empty v-else description="请选择 MCP 服务器" />
    </el-drawer>
  </section>
</template>

<style scoped lang="scss">
.mcp-servers-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 112px);
  min-height: 0;
}

.mcp-servers-page :deep(.el-dropdown) {
  position: fixed;
  width: 0;
  height: 0;
  overflow: hidden;
}

.mcp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
}

.mcp-toolbar :deep(.el-segmented) {
  padding: 4px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: 999px;
  background: var(--ds-color-surface);
}

.mcp-toolbar :deep(.el-segmented__group) {
  gap: 2px;
}

.mcp-toolbar :deep(.el-segmented__item) {
  min-width: 68px;
  height: 34px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
}

.mcp-toolbar :deep(.el-segmented__item-label) {
  padding: 0 16px;
}

.mcp-toolbar :deep(.el-segmented__item-selected) {
  border-radius: 999px;
}

.mcp-toolbar__count {
  color: var(--ds-color-text-muted);
  font-size: 13px;
  font-weight: 600;
}

.mcp-card-context {
  flex: 1;
  height: 100%;
  min-height: 0;
}

.mcp-card-scroll {
  height: 100%;
  min-height: 0;
}

.mcp-list {
  min-height: 100%;
  padding-right: 12px;
}

.mcp-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  min-height: 100%;
}

.mcp-context-trigger {
  display: inline-block;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.mcp-drawer :deep(.el-drawer__body) {
  height: 100%;
  padding: 0;
}

.mcp-drawer__content {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
}

.mcp-drawer__header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.mcp-drawer__heading {
  display: grid;
  gap: 6px;
  min-width: 0;

  h2,
  p {
    margin: 0;
  }

  h2 {
    color: var(--ds-color-text);
    font-size: 22px;
  }

  p {
    color: var(--ds-color-text-muted);
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
}

.mcp-drawer__kicker {
  color: var(--ds-color-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.mcp-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.mcp-info__item {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface-soft);

  span {
    color: var(--ds-color-text-muted);
    font-size: 12px;
    font-weight: 600;
  }

  strong,
  p {
    margin: 0;
    min-width: 0;
    color: var(--ds-color-text);
    overflow-wrap: anywhere;
  }
}

.mcp-info__item--wide {
  grid-column: 1 / -1;
}

.mcp-editor {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.mcp-editor__label {
  display: grid;
  gap: 4px;

  span {
    color: var(--ds-color-text);
    font-weight: 700;
  }

  small {
    color: var(--ds-color-text-muted);
  }
}

.mcp-drawer__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--ds-color-border-soft);
}

:global(.mcp-context-menu) {
  width: 156px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-panel);
  box-shadow: var(--ds-shadow-hover);
}

:global(.mcp-context-menu .el-dropdown-menu) {
  padding: 6px;
}

:global(.mcp-context-menu .el-dropdown-menu__item) {
  border-radius: var(--ds-radius-control);
  color: var(--ds-color-text);
  font-weight: 600;
}

:global(.mcp-context-menu .el-dropdown-menu__item:not(.is-disabled):hover) {
  background: var(--ds-state-active-bg);
  color: var(--ds-state-active-color);
}
</style>

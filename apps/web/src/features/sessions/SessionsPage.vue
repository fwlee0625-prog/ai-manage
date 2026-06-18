<script setup lang="ts">
import ChatViewToolbar from "../../components/chat/ChatViewToolbar.vue";
import VirtualMessageList from "../../components/chat/VirtualMessageList.vue";
import { DsPanel, DsSplitView } from "../../components/design-system";
import { useSessions } from "./use-sessions";

const {
  projects,
  selectedProjectPath,
  selectedSession,
  messageListRef,
  deletingSession,
  chatDisplayMode,
  visibleChatRoles,
  chatMessages,
  relativeTime,
  sessionsForProject,
  shouldShowToggle,
  projectToggleLabel,
  toggleProject,
  toggleProjectSessionLimit,
  selectSession,
  deleteSelectedSession,
  Delete,
} = useSessions();
</script>

<template>
  <section class="sessions-page">
    <DsSplitView left-width="42%">
      <template #left>
        <DsPanel
          fill
          class="session-list-panel"
          title="项目与对话"
          description="按项目聚合历史会话"
        >
          <el-scrollbar class="project-session-list">
            <div class="project-session-list__content">
              <section
                v-for="project in projects"
                :key="project.tool + project.projectPath"
                class="project-group"
              >
                <button
                  class="project-header"
                  :class="{
                    active: selectedProjectPath === project.projectPath,
                  }"
                  type="button"
                  @click="toggleProject(project.projectPath)"
                >
                  <span class="folder-icon" aria-hidden="true"></span>
                  <span class="project-name" :title="project.projectPath">
                    {{ project.projectName }}
                  </span>
                  <span class="project-count">{{ project.sessionCount }}</span>
                </button>
                <div
                  v-if="selectedProjectPath === project.projectPath"
                  class="project-sessions"
                >
                  <button
                    v-for="session in sessionsForProject(project.projectPath)"
                    :key="session.tool + session.id"
                    type="button"
                    class="session-row"
                    :class="{
                      active:
                        selectedSession?.id === session.id &&
                        selectedSession?.tool === session.tool,
                    }"
                    @click="selectSession(session)"
                  >
                    <span class="session-row-title">{{ session.title }}</span>
                    <span class="session-row-time">
                      {{ relativeTime(session.updatedAt) }}
                    </span>
                  </button>
                  <button
                    v-if="
                      shouldShowToggle(
                        project.projectPath,
                        project.sessionCount,
                      )
                    "
                    type="button"
                    class="expand-row"
                    @click="
                      toggleProjectSessionLimit(
                        project.projectPath,
                        project.sessionCount,
                      )
                    "
                  >
                    {{
                      projectToggleLabel(
                        project.projectPath,
                        project.sessionCount,
                      )
                    }}
                  </button>
                </div>
              </section>
              <el-empty v-if="!projects.length" description="暂无会话" />
            </div>
          </el-scrollbar>
        </DsPanel>
      </template>

      <DsPanel
        fill
        class="session-detail-panel"
        :title="selectedSession?.title || '选择会话'"
        description="阅读历史会话并按角色筛选"
      >
        <template #actions>
          <div v-if="selectedSession" class="detail-actions">
            <ChatViewToolbar
              v-model:mode="chatDisplayMode"
              v-model:visible-roles="visibleChatRoles"
            />
            <el-button
              :icon="Delete"
              type="danger"
              plain
              circle
              title="删除会话"
              :loading="deletingSession"
              @click="deleteSelectedSession"
            />
          </div>
        </template>

        <div v-if="selectedSession" class="session-detail-body">
          <VirtualMessageList
            ref="messageListRef"
            :messages="chatMessages"
            :mode="chatDisplayMode"
            :visible-roles="visibleChatRoles"
          />
        </div>
        <el-empty v-else description="请选择左侧会话" />
      </DsPanel>
    </DsSplitView>
  </section>
</template>

<style scoped lang="scss">
.sessions-page {
  min-height: 0;
}

.detail-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.project-session-list {
  height: 100%;
  min-height: 0;
}

.project-session-list__content {
  min-height: 100%;
  padding-right: 16px;
}

.project-group {
  border-radius: var(--ds-radius-control);
  margin-bottom: 4px;
}

.project-header,
.session-row,
.expand-row {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.project-header {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 12px;
  border-radius: var(--ds-radius-control);
  font-size: 14px;
  font-weight: 400;
  color: var(--ds-color-text-muted);
}
.project-header:hover,
.project-header.active,
.session-row:hover,
.session-row.active,
.expand-row:hover {
  border-color: var(--ds-state-active-border);
  background: var(--ds-state-active-bg);
}

.folder-icon {
  position: relative;
  width: 20px;
  height: 15px;
  border: 2px solid var(--ds-color-text-muted);
  border-radius: 3px;
}

.folder-icon::before {
  position: absolute;
  top: -6px;
  left: 1px;
  width: 9px;
  height: 6px;
  border: 2px solid var(--ds-color-text-muted);
  border-bottom: 0;
  border-radius: 3px 3px 0 0;
  content: "";
}

.project-name,
.session-row-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-count {
  color: var(--ds-color-text-muted);
  font-size: 13px;
}

.session-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54px;
  gap: 12px;
  align-items: center;
  min-height: 36px;
  padding: 5px 4px 5px 56px;
  border-radius: var(--ds-radius-control);
  color: var(--ds-color-text-muted);
  font-size: 13px;
}

.session-row.active {
  color: var(--ds-color-text);
}

.session-row-title {
  font-weight: 500;
}

.session-row-time {
  color: var(--ds-color-text-muted);
  font-size: 12px;
  text-align: right;
  white-space: nowrap;
}

.expand-row {
  padding: 8px 4px 2px 56px;
  color: var(--ds-color-text-muted);
  font-size: 13px;
  font-weight: 600;
}

.session-detail-body {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>

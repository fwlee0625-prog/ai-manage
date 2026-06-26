<script setup lang="ts">
import { computed } from "vue";
import ChatViewToolbar from "../../components/chat/ChatViewToolbar.vue";
import VirtualMessageList from "../../components/chat/VirtualMessageList.vue";
import { DsPanel, DsSplitView } from "../../components/design-system";
import ProjectSessionList from "./components/ProjectSessionList.vue";
import { useSessions } from "./use-sessions";

const {
  projects,
  selectedProjectPath,
  selectedSession,
  messageListRef,
  deletingSession,
  deletingSessionKey,
  chatDisplayMode,
  visibleChatRoles,
  showMirrorEvents,
  chatMessages,
  relativeTime,
  sessionsForProject,
  shouldShowToggle,
  projectToggleLabel,
  toggleProject,
  toggleProjectSessionLimit,
  selectSession,
  deleteSession,
  deleteSelectedSession,
  isDeletingSession,
  Delete,
} = useSessions();

const selectedProject = computed(() =>
  projects.value.find(project => project.projectPath === selectedProjectPath.value),
);
const visibleProjectSessions = computed(() =>
  selectedProjectPath.value ? sessionsForProject(selectedProjectPath.value) : [],
);
const showProjectSessionToggle = computed(() =>
  !!selectedProject.value
  && shouldShowToggle(selectedProject.value.projectPath, selectedProject.value.sessionCount),
);
const projectSessionToggleLabel = computed(() =>
  selectedProject.value
    ? projectToggleLabel(selectedProject.value.projectPath, selectedProject.value.sessionCount)
    : '展开显示',
);
</script>

<template>
  <section class="sessions-page">
    <DsSplitView left-width="42%">
      <template #left>
        <ProjectSessionList
          :projects="projects"
          :selected-project-path="selectedProjectPath"
          :sessions="visibleProjectSessions"
          :selected-session="selectedSession"
          :show-toggle="showProjectSessionToggle"
          :toggle-label="projectSessionToggleLabel"
          :deleting-session-key="deletingSessionKey"
          :format-session-time="relativeTime"
          @toggle-project="toggleProject"
          @select-session="selectSession"
          @delete-session="deleteSession"
          @toggle-session-limit="toggleProjectSessionLimit"
        />
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
              v-model:show-mirror-events="showMirrorEvents"
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

.session-detail-body {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>

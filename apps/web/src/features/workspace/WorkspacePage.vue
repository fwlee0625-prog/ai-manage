<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { DsSplitView } from '../../components/design-system';
import ProjectSessionList from '../sessions/components/ProjectSessionList.vue';
import ConversationVisualPanel from './components/ConversationVisualPanel.vue';
import TerminalDock from './components/TerminalDock.vue';
import { useWorkspace } from './use-workspace';

const {
  projects,
  sessions,
  selectedProjectPath,
  selectedSession,
  workspaceMessages,
  conversationSkills,
  terminalSessions,
  activeProjectTerminalSession,
  activeTerminalSessionId,
  activeTerminalOutput,
  terminalStarting,
  relativeTime,
  selectedProjectName,
  refreshWorkspaceIndex,
  selectProject,
  selectSession,
  startTerminal,
  selectTerminal,
  closeTerminal,
  sendInput,
  sendChatMessage,
  resizeActive,
  isTerminalClosing,
} = useWorkspace();

const collapsedSessionLimit = 5;
const sessionLimitStep = 10;
const visibleSessionLimit = shallowRef(collapsedSessionLimit);
const detailView = shallowRef<'conversation' | 'terminal'>('conversation');
const detailViewOptions = [
  { label: '对话视图', value: 'conversation' },
  { label: '终端视图', value: 'terminal' },
];

const selectedProject = computed(() =>
  projects.value.find(project => project.projectPath === selectedProjectPath.value),
);
const visibleProjectSessions = computed(() =>
  sessions.items.slice(0, visibleSessionLimit.value),
);
const showProjectSessionToggle = computed(() =>
  Boolean(selectedProject.value && selectedProject.value.sessionCount > collapsedSessionLimit),
);
const projectSessionToggleLabel = computed(() =>
  visibleSessionLimit.value >= Math.min(selectedProject.value?.sessionCount || 0, sessions.items.length)
    ? '折叠显示'
    : '展开显示',
);

function toggleProjectSessionLimit(_projectPath: string, sessionCount: number) {
  if (visibleSessionLimit.value >= Math.min(sessionCount, sessions.items.length)) {
    visibleSessionLimit.value = collapsedSessionLimit;
    return;
  }
  visibleSessionLimit.value = Math.min(
    visibleSessionLimit.value + sessionLimitStep,
    sessionCount,
    sessions.items.length,
  );
}

watch(selectedProjectPath, () => {
  visibleSessionLimit.value = collapsedSessionLimit;
});
</script>

<template>
  <section class="workspace-page">
    <DsSplitView left-width="36%">
      <template #left>
        <ProjectSessionList
          :projects="projects"
          :selected-project-path="selectedProjectPath"
          :sessions="visibleProjectSessions"
          :selected-session="selectedSession"
          :show-toggle="showProjectSessionToggle"
          :toggle-label="projectSessionToggleLabel"
          :format-session-time="relativeTime"
          :show-delete="false"
          title=""
          description=""
          empty-text="暂无项目会话"
          @toggle-project="selectProject"
          @select-session="selectSession"
          @toggle-session-limit="toggleProjectSessionLimit"
        />
      </template>

      <div class="workspace-page__detail">
        <header class="workspace-page__viewbar">
          <el-segmented
            v-model="detailView"
            size="small"
            :options="detailViewOptions"
          />
        </header>

        <div class="workspace-page__view">
          <ConversationVisualPanel
            v-show="detailView === 'conversation'"
            :session="selectedSession"
            :terminal-session="activeProjectTerminalSession"
            :messages="workspaceMessages"
            :skills="conversationSkills"
            :can-start="Boolean(selectedProjectPath)"
            :sending="terminalStarting"
            @start="startTerminal"
            @send="sendChatMessage"
          />

          <TerminalDock
            v-show="detailView === 'terminal'"
            :active="detailView === 'terminal'"
            :sessions="terminalSessions"
            :active-session-id="activeTerminalSessionId"
            :active-output="activeTerminalOutput"
            :current-project-name="selectedProjectName()"
            :can-start="Boolean(selectedProjectPath)"
            :starting="terminalStarting"
            :is-closing="isTerminalClosing"
            @start="startTerminal"
            @refresh="refreshWorkspaceIndex"
            @select="selectTerminal"
            @close="closeTerminal"
            @input="sendInput"
            @resize="resizeActive"
          />
        </div>
      </div>
    </DsSplitView>
  </section>
</template>

<style scoped lang="scss">
.workspace-page {
  height: 100%;
  min-height: 0;
}

.workspace-page :deep(.ds-split-view) {
  height: 100%;
}

.workspace-page__detail {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.workspace-page__viewbar {
  display: flex;
  justify-content: flex-end;
  min-height: 32px;
}

.workspace-page__view {
  min-width: 0;
  min-height: 0;
}

.workspace-page__view > * {
  width: 100%;
  height: 100%;
}
</style>

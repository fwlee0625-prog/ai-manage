<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue';
import type { ProjectSummary, SessionSummary } from '@ai-manage/shared';
import { DsPanel } from '../../../components/design-system';

const props = withDefaults(defineProps<{
  title?: string;
  description?: string;
  projects: ProjectSummary[];
  selectedProjectPath: string;
  sessions: SessionSummary[];
  selectedSession?: Pick<SessionSummary, 'id' | 'tool'>;
  showToggle?: boolean;
  toggleLabel?: string;
  deletingSessionKey?: string;
  showDelete?: boolean;
  emptyText?: string;
  formatSessionTime?: (value?: string) => string;
}>(), {
  title: '项目与对话',
  description: '按项目聚合历史会话',
  showToggle: false,
  toggleLabel: '展开显示',
  deletingSessionKey: '',
  showDelete: true,
  emptyText: '暂无会话',
  formatSessionTime: (value?: string) => value || '',
});

const emit = defineEmits<{
  toggleProject: [projectPath: string];
  selectSession: [session: SessionSummary];
  deleteSession: [session: SessionSummary];
  toggleSessionLimit: [projectPath: string, sessionCount: number];
}>();

function isSelectedSession(session: SessionSummary) {
  return props.selectedSession?.id === session.id && props.selectedSession?.tool === session.tool;
}

function isDeletingSession(session: SessionSummary) {
  return props.deletingSessionKey === `${session.tool}:${session.id}`;
}
</script>

<template>
  <DsPanel
    fill
    class="session-list-panel"
    :title="title"
    :description="description"
  >
    <el-scrollbar class="project-session-list">
      <div class="project-session-list__content">
        <section
          v-for="project in projects"
          :key="project.tool + project.projectPath"
          class="project-group"
          :class="{ active: selectedProjectPath === project.projectPath }"
        >
          <button
            class="project-header"
            type="button"
            @click="emit('toggleProject', project.projectPath)"
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
            <div
              v-for="session in sessions"
              :key="session.tool + session.id"
              role="button"
              tabindex="0"
              class="session-row"
              :class="{ active: isSelectedSession(session) }"
              @click="emit('selectSession', session)"
              @keydown.enter="emit('selectSession', session)"
              @keydown.space.prevent="emit('selectSession', session)"
            >
              <span class="session-row-title">{{ session.title }}</span>
              <span class="session-row-meta">
                <span class="session-row-time">
                  {{ formatSessionTime(session.updatedAt) }}
                </span>
                <button
                  v-if="showDelete"
                  class="session-row-delete"
                  type="button"
                  title="删除会话"
                  :disabled="isDeletingSession(session)"
                  @click.stop="emit('deleteSession', session)"
                >
                  <el-icon><Delete /></el-icon>
                </button>
              </span>
            </div>

            <button
              v-if="showToggle"
              type="button"
              class="expand-row"
              @click="emit('toggleSessionLimit', project.projectPath, project.sessionCount)"
            >
              {{ toggleLabel }}
            </button>
          </div>
        </section>
        <el-empty v-if="!projects.length" :description="emptyText" />
      </div>
    </el-scrollbar>
  </DsPanel>
</template>

<style scoped lang="scss">
.project-session-list {
  height: 100%;
  min-height: 0;
}

.project-session-list__content {
  min-height: 100%;
  padding-right: 16px;
}

.project-group {
  border: 1px solid transparent;
  border-radius: var(--ds-radius-control);
  padding-inline: 8px;
  padding-block: 4px;
  &.active {
    border-color: rgb(87 204 153 / 28%);
    background:
      linear-gradient(180deg, rgb(128 237 153 / 10%), rgb(248 255 248 / 74%)),
      var(--ds-color-surface-soft);
  }
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
  outline: none;
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
.session-row:focus-visible,
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
  grid-template-columns: minmax(0, 1fr) 58px;
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

.session-row-meta {
  position: relative;
  display: grid;
  justify-items: end;
  min-width: 58px;
}

.session-row-time {
  color: var(--ds-color-text-muted);
  font-size: 12px;
  text-align: right;
  white-space: nowrap;
  transition: opacity 0.16s ease;
}

.session-row-delete {
  position: absolute;
  top: 50%;
  right: 0;
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  background: transparent;
  color: rgb(239 68 68 / 82%);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
  transition: opacity 0.16s ease;
}

.session-row-delete:hover {
  color: var(--ds-color-danger);
}

.session-row-delete:disabled {
  cursor: default;
  opacity: 0.45;
}

.session-row:hover .session-row-time,
.session-row:focus-within .session-row-time {
  opacity: 0;
}

.session-row:hover .session-row-delete,
.session-row:focus-within .session-row-delete {
  opacity: 1;
  pointer-events: auto;
}

.session-row:hover .session-row-delete:disabled,
.session-row:focus-within .session-row-delete:disabled {
  opacity: 0.45;
}

.expand-row {
  padding: 8px 4px 2px 56px;
  color: var(--ds-color-text-muted);
  font-size: 13px;
  font-weight: 600;
}
</style>

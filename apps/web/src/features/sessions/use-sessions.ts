import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { Delete } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { relativeTimeFromNow } from '@ai-manage/shared';
import type { PaginatedResult, ProjectSummary, SessionDetail, SessionSummary } from '@ai-manage/shared';
import { api } from '../../api';
import { defaultVisibleChatRoles, filterMirrorEvents, toChatMessageViewModel } from '../../components/chat/message';
import type VirtualMessageList from '../../components/chat/VirtualMessageList.vue';
import type { ChatDisplayMode, ChatMessageRole } from '../../components/chat/types';
import { refreshRevision, selectedTool } from '../../state/app-state';

const collapsedSessionLimit = 5;
const sessionLimitStep = 10;
const deletionConfirmTitleMaxLength = 32;

export function useSessions() {
  const projects = ref<ProjectSummary[]>([]);
  const selectedProjectPath = ref('');
  const projectSessionLimits = ref(new Map<string, number>());
  const sessions = reactive<PaginatedResult<SessionSummary>>({ items: [], total: 0, page: 1, pageSize: 5000 });
  const selectedSession = ref<SessionDetail>();
  const messageListRef = ref<InstanceType<typeof VirtualMessageList>>();
  const deletingSessionId = ref('');
  const deletingSession = computed(() => !!deletingSessionId.value);
  const deletingSessionKey = computed(() => deletingSessionId.value);
  const chatDisplayMode = ref<ChatDisplayMode>('chat');
  const visibleChatRoles = ref<ChatMessageRole[]>([...defaultVisibleChatRoles]);
  const showMirrorEvents = ref(false);
  const sessionQuery = reactive({ page: 1, pageSize: 5000 });

  const allChatMessages = computed(() => selectedSession.value?.messages.map(toChatMessageViewModel) || []);
  const chatMessages = computed(() => showMirrorEvents.value ? allChatMessages.value : filterMirrorEvents(allChatMessages.value));

  function relativeTime(value?: string) {
    return relativeTimeFromNow(value);
  }

  function sessionsForProject(projectPath: string) {
    if (selectedProjectPath.value !== projectPath) return [];
    const limit = visibleSessionLimit(projectPath);
    return sessions.items.slice(0, limit);
  }

  function visibleSessionLimit(projectPath: string) {
    return projectSessionLimits.value.get(projectPath) || collapsedSessionLimit;
  }

  function isProjectFullyVisible(projectPath: string, sessionCount: number) {
    return visibleSessionLimit(projectPath) >= Math.min(sessionCount, sessions.items.length);
  }

  function shouldShowToggle(projectPath: string, sessionCount: number) {
    return selectedProjectPath.value === projectPath
      && sessionCount > collapsedSessionLimit;
  }

  function projectToggleLabel(projectPath: string, sessionCount: number) {
    return isProjectFullyVisible(projectPath, sessionCount) ? '折叠显示' : '展开显示';
  }

  async function loadProjects() {
    projects.value = await api.projects(selectedTool.value);
    if (!projects.value.some(project => project.projectPath === selectedProjectPath.value)) {
      selectedProjectPath.value = '';
      sessionQuery.page = 1;
      projectSessionLimits.value = new Map();
    }
  }

  async function loadSessions() {
    if (!selectedProjectPath.value) {
      Object.assign(sessions, { items: [], total: 0, page: 1, pageSize: sessionQuery.pageSize });
      return;
    }
    const result = await api.sessions({
      tool: selectedTool.value || undefined,
      projectPath: selectedProjectPath.value || undefined,
      page: sessionQuery.page,
      pageSize: sessionQuery.pageSize,
    });
    Object.assign(sessions, result);
  }

  async function reloadSessionsPage() {
    selectedProjectPath.value = '';
    selectedSession.value = undefined;
    sessionQuery.page = 1;
    projectSessionLimits.value = new Map();
    await loadProjects();
    await loadSessions();
  }

  async function selectProject(projectPath: string) {
    if (selectedProjectPath.value === projectPath) {
      selectedProjectPath.value = '';
      selectedSession.value = undefined;
      projectSessionLimits.value = new Map();
      Object.assign(sessions, { items: [], total: 0, page: 1, pageSize: sessionQuery.pageSize });
      return;
    }
    selectedProjectPath.value = projectPath;
    selectedSession.value = undefined;
    sessionQuery.page = 1;
    projectSessionLimits.value = new Map([[projectPath, collapsedSessionLimit]]);
    await loadSessions();
  }

  async function toggleProject(projectPath: string) {
    await selectProject(projectPath);
  }

  function toggleProjectSessionLimit(projectPath: string, sessionCount: number) {
    if (!selectedProjectPath.value || selectedProjectPath.value !== projectPath) return;
    const current = visibleSessionLimit(projectPath);
    const next = new Map(projectSessionLimits.value);
    if (isProjectFullyVisible(projectPath, sessionCount)) {
      next.set(projectPath, collapsedSessionLimit);
    } else {
      next.set(projectPath, Math.min(current + sessionLimitStep, sessionCount, sessions.items.length));
    }
    projectSessionLimits.value = next;
  }

  async function selectSession(row: SessionSummary) {
    selectedSession.value = await api.session(row.tool, row.id);
    await nextTick();
    messageListRef.value?.scrollToBottom();
  }

  function isDeletingSession(row: SessionSummary) {
    return deletingSessionId.value === `${row.tool}:${row.id}`;
  }

  async function deleteSession(row: SessionSummary) {
    const session = row;
    const displayTitle = truncateText(session.title, deletionConfirmTitleMaxLength);
    try {
      await ElMessageBox.confirm(
        `确定删除「${displayTitle}」吗？原始会话会从 ${session.tool === 'codex' ? 'Codex' : 'Claude'} 数据目录移除。`,
        '删除历史会话',
        {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          confirmButtonClass: 'el-button--danger',
        },
      );
    } catch {
      return;
    }

    deletingSessionId.value = `${session.tool}:${session.id}`;
    try {
      const result = await api.deleteSession(session.tool, session.id);
      if (selectedSession.value?.tool === session.tool && selectedSession.value.id === session.id) {
        selectedSession.value = undefined;
      }
      await loadProjects();
      await loadSessions();
      ElMessage.success(`已删除，备份：${result.backupDir}`);
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    } finally {
      deletingSessionId.value = '';
    }
  }

  async function deleteSelectedSession() {
    if (!selectedSession.value) return;
    await deleteSession(selectedSession.value);
  }

  watch([selectedTool, refreshRevision], reloadSessionsPage);
  watch([chatDisplayMode, showMirrorEvents, () => visibleChatRoles.value.join(',')], async () => {
    await nextTick();
    messageListRef.value?.scrollToBottom();
  });
  onMounted(async () => {
    await loadProjects();
    await loadSessions();
  });

  return {
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
  };
}

/**
 * Truncates long dialog text without splitting Unicode code points.
 */
function truncateText(value: string, maxLength: number) {
  const chars = Array.from(value.trim());
  if (chars.length <= maxLength) return value;
  return `${chars.slice(0, maxLength).join('')}...`;
}

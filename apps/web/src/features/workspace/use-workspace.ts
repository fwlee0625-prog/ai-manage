import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type {
  PaginatedResult,
  ProjectSummary,
  SessionDetail,
  SessionSummary,
  SkillSummary,
  TerminalSessionSummary,
} from '@ai-manage/shared';
import { relativeTimeFromNow } from '@ai-manage/shared';
import { api } from '../../api';
import { filterMirrorEvents, toChatMessageViewModel } from '../../components/chat/message';
import type { ChatMessageViewModel } from '../../components/chat/types';
import { refreshIndex, refreshRevision, selectedTool } from '../../state/app-state';
import { liveTerminalMessagesFromOutput } from './live-terminal';
import { useWorkspaceTerminals } from './use-workspace-terminals';

const sessionPageSize = 5000;
const liveSessionRefreshMs = 1200;

interface LiveRunState {
  waitingForFirstOutput: boolean;
  startedAt?: number;
}

/**
 * Coordinates workspace project selection, historical conversations and terminal sessions.
 */
export function useWorkspace() {
  const projects = ref<ProjectSummary[]>([]);
  const sessions = reactive<PaginatedResult<SessionSummary>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: sessionPageSize,
  });
  const selectedProjectPath = ref('');
  const selectedSession = ref<SessionDetail>();
  const workspaceSkills = ref<SkillSummary[]>([]);
  const liveTerminalMessages = ref(new Map<string, ChatMessageViewModel[]>());
  const liveRunStates = ref(new Map<string, LiveRunState>());
  const liveClockNow = ref(Date.now());
  let liveSessionRefreshTimer: ReturnType<typeof window.setInterval> | undefined;
  let liveClockTimer: ReturnType<typeof window.setInterval> | undefined;
  let refreshingLiveSession = false;

  const terminals = useWorkspaceTerminals({
    onTerminalOutput: markTerminalOutputReceived,
    onTerminalExit: async (sessionId) => {
      clearLiveRun(sessionId);
      await refreshIndex();
      await loadProjects();
      await loadSessions();
    },
  });

  const allChatMessages = computed(() =>
    selectedSession.value?.messages.map(toChatMessageViewModel) || [],
  );
  const chatMessages = computed(() =>
    filterMirrorEvents(allChatMessages.value),
  );
  const activeConversationTerminalSession = computed(() => {
    if (!selectedSession.value) return undefined;
    const activeSession = terminals.activeTerminalSession.value;
    if (isSelectedConversationTerminal(activeSession)) return activeSession;
    return terminals.terminalSessions.value.find(session =>
      session.status === 'running' && isSelectedConversationTerminal(session),
    ) || terminals.terminalSessions.value.find(isSelectedConversationTerminal);
  });
  const activeProjectTerminalSession = computed<TerminalSessionSummary | undefined>(() => {
    if (activeConversationTerminalSession.value) return activeConversationTerminalSession.value;
    if (!selectedProjectPath.value) return undefined;
    const activeSession = terminals.activeTerminalSession.value;
    if (isSelectedProjectTerminal(activeSession)) return activeSession;
    return terminals.terminalSessions.value.find(session =>
      session.status === 'running' && isSelectedProjectTerminal(session),
    ) || terminals.terminalSessions.value.find(isSelectedProjectTerminal);
  });
  const activeProjectTerminalSessionId = computed(() =>
    activeProjectTerminalSession.value?.id || '',
  );
  const activeConversationTerminalSessionId = computed(() =>
    activeConversationTerminalSession.value?.id || '',
  );
  const activeTerminalMessages = computed(() =>
    activeProjectTerminalSessionId.value
      ? visibleLiveMessages(activeProjectTerminalSessionId.value, [])
      : [],
  );
  const workspaceMessages = computed(() =>
    selectedSession.value
      ? [...chatMessages.value, ...activeConversationMessages(), ...activeLiveRuntimeMessages()]
      : [...activeTerminalMessages.value, ...activeLiveRuntimeMessages()],
  );
  const selectedProject = computed(() =>
    projects.value.find(project => project.projectPath === selectedProjectPath.value),
  );
  const conversationSkills = computed(() => {
    const selectedPath = selectedProjectPath.value;
    return workspaceSkills.value
      .filter(skill =>
        skill.scope === 'system'
        || !skill.projectPath
        || skill.projectPath === selectedPath,
      )
      .sort((left, right) =>
        Number(right.scope === 'project') - Number(left.scope === 'project')
        || left.name.localeCompare(right.name),
      );
  });

  async function loadProjects() {
    projects.value = await api.projects(selectedTool.value);
    if (!projects.value.some(project => project.projectPath === selectedProjectPath.value)) {
      selectedProjectPath.value = projects.value[0]?.projectPath || '';
      selectedSession.value = undefined;
    }
  }

  async function loadSessions() {
    if (!selectedProjectPath.value) {
      Object.assign(sessions, { items: [], total: 0, page: 1, pageSize: sessionPageSize });
      return;
    }
    const result = await api.sessions({
      tool: selectedTool.value,
      projectPath: selectedProjectPath.value,
      page: 1,
      pageSize: sessionPageSize,
    });
    Object.assign(sessions, result);
  }

  /** Loads slash-command skill candidates for the currently selected tool. */
  async function loadWorkspaceSkills() {
    try {
      workspaceSkills.value = await api.skills(selectedTool.value);
    } catch (error) {
      workspaceSkills.value = [];
      ElMessage.warning(error instanceof Error ? error.message : String(error));
    }
  }

  async function reloadWorkspace() {
    selectedSession.value = undefined;
    await Promise.all([
      loadProjects().then(loadSessions),
      loadWorkspaceSkills(),
      terminals.loadTerminalSessions(),
    ]);
  }

  async function selectProject(projectPath: string) {
    if (selectedProjectPath.value === projectPath) return;
    selectedProjectPath.value = projectPath;
    selectedSession.value = undefined;
    await loadSessions();
  }

  async function selectSession(session: SessionSummary) {
    selectedSession.value = await api.session(session.tool, session.id);
    clearConversationLiveMessages(session.id);
  }

  async function startTerminal() {
    const session = await terminals.startTerminal(selectedTool.value, selectedProjectPath.value);
    if (session) {
      selectedSession.value = undefined;
      await selectProject(session.projectPath);
    }
  }

  async function selectTerminal(sessionId: string) {
    const terminal = terminals.terminalSessions.value.find(session => session.id === sessionId);
    if (!terminal) return;
    terminals.selectTerminal(sessionId);
    selectedSession.value = undefined;
    await selectProject(terminal.projectPath);
  }

  /** Sends a visual chat prompt to the active PTY session, starting one for the selected project if needed. */
  async function sendChatMessage(content: string) {
    const preparedContent = content.replace(/\r\n/g, '\n').trimEnd();
    if (!preparedContent.trim()) return false;

    const sessionToResume = selectedSession.value;
    let terminal = sessionToResume
      ? activeConversationTerminalSession.value
      : activeProjectTerminalSession.value;
    if (!terminal || terminal.status !== 'running') {
      terminal = await terminals.startTerminal(
        sessionToResume?.tool || selectedTool.value,
        sessionToResume?.projectPath || selectedProjectPath.value,
        sessionToResume?.id,
      );
      if (!terminal) return false;
      if (!sessionToResume) await selectProject(terminal.projectPath);
    }

    terminals.selectTerminal(terminal.id);
    const sent = terminals.sendInput(toTerminalInput(preparedContent), terminal.id);
    if (!sent) {
      ElMessage.warning('当前终端会话不可输入，请重新启动会话');
      return false;
    }
    appendLiveUserMessage(terminal.id, preparedContent);
    markLiveRunWaiting(terminal.id);
    return true;
  }

  /** Removes cached visual-only messages after a terminal session is closed. */
  async function closeTerminal(sessionId: string) {
    await terminals.closeTerminal(sessionId);
    const nextMessages = new Map(liveTerminalMessages.value);
    nextMessages.delete(sessionId);
    liveTerminalMessages.value = nextMessages;
    clearLiveRun(sessionId);
  }

  /** Creates a local user message that mirrors text sent through the PTY. */
  function appendLiveUserMessage(sessionId: string, content: string) {
    const nextMessages = new Map(liveTerminalMessages.value);
    const messages = nextMessages.get(sessionId) || [];
    const timestamp = new Date().toISOString();
    nextMessages.set(sessionId, [
      ...messages,
      {
        id: `terminal-${sessionId}-${timestamp}-${messages.length}`,
        role: 'user',
        originalRole: 'terminal-input',
        content,
        rawText: content,
        images: [],
        mirrorEvent: false,
        timestamp,
        raw: { type: 'terminal_input', sessionId, content },
      },
    ]);
    liveTerminalMessages.value = nextMessages;
  }

  /** Wraps multi-line prompts as a bracketed paste before pressing Enter in the terminal app. */
  function toTerminalInput(content: string) {
    if (!content.includes('\n')) return `${content}\r`;
    return `\u001B[200~${content}\u001B[201~\r`;
  }

  function relativeTime(value?: string) {
    return relativeTimeFromNow(value);
  }

  function selectedProjectName() {
    return selectedProject.value?.projectName || '未选择项目';
  }

  function activeConversationMessages() {
    return activeConversationTerminalSessionId.value
      ? visibleLiveMessages(activeConversationTerminalSessionId.value, chatMessages.value)
      : [];
  }

  function activeLiveRuntimeMessages() {
    const terminalSessionId = activeProjectTerminalSessionId.value;
    if (!terminalSessionId || activeProjectTerminalSession.value?.status !== 'running') return [];
    const runState = liveRunStates.value.get(terminalSessionId);
    if (!runState) return [];
    const elapsedSeconds = runState.startedAt === undefined
      ? undefined
      : Math.max(0, Math.floor((liveClockNow.value - runState.startedAt) / 1000));
    return liveTerminalMessagesFromOutput(
      terminalSessionId,
      terminals.terminalOutputFor(terminalSessionId),
      {
        elapsedSeconds,
        waitingForFirstOutput: runState.waitingForFirstOutput,
      },
    );
  }

  function markLiveRunWaiting(sessionId: string) {
    const nextRuns = new Map(liveRunStates.value);
    nextRuns.set(sessionId, { waitingForFirstOutput: true });
    liveRunStates.value = nextRuns;
  }

  function markTerminalOutputReceived(sessionId: string, data: string) {
    if (!data.trim()) return;
    const current = liveRunStates.value.get(sessionId);
    if (!current || current.startedAt !== undefined) return;
    const nextRuns = new Map(liveRunStates.value);
    nextRuns.set(sessionId, {
      waitingForFirstOutput: false,
      startedAt: Date.now(),
    });
    liveRunStates.value = nextRuns;
    startLiveClock();
  }

  function clearLiveRun(sessionId: string) {
    if (!liveRunStates.value.has(sessionId)) return;
    const nextRuns = new Map(liveRunStates.value);
    nextRuns.delete(sessionId);
    liveRunStates.value = nextRuns;
    stopLiveClockIfIdle();
  }

  function startLiveClock() {
    liveClockNow.value = Date.now();
    if (liveClockTimer) return;
    liveClockTimer = window.setInterval(() => {
      liveClockNow.value = Date.now();
    }, 1000);
  }

  function stopLiveClockIfIdle() {
    if (!liveClockTimer) return;
    const hasStartedRun = Array.from(liveRunStates.value.values())
      .some(run => run.startedAt !== undefined);
    if (hasStartedRun) return;
    window.clearInterval(liveClockTimer);
    liveClockTimer = undefined;
  }

  function visibleLiveMessages(terminalSessionId: string, historyMessages: ChatMessageViewModel[]) {
    const historyUserContents = new Set(
      historyMessages
        .filter(message => message.role === 'user')
        .map(message => normalizeComparableContent(message.content)),
    );
    return (liveTerminalMessages.value.get(terminalSessionId) || [])
      .filter(message => !historyUserContents.has(normalizeComparableContent(message.content)));
  }

  function normalizeComparableContent(content: string) {
    return content.replace(/\s+/g, ' ').trim();
  }

  function clearConversationLiveMessages(sessionId: string) {
    const nextMessages = new Map(liveTerminalMessages.value);
    terminals.terminalSessions.value
      .filter(session => session.resumeSessionId === sessionId)
      .forEach(session => nextMessages.delete(session.id));
    liveTerminalMessages.value = nextMessages;
  }

  function isSelectedConversationTerminal(session?: TerminalSessionSummary) {
    return Boolean(
      session
        && selectedSession.value
        && session.tool === selectedSession.value.tool
        && session.projectPath === selectedSession.value.projectPath
        && session.resumeSessionId === selectedSession.value.id,
    );
  }

  function isSelectedProjectTerminal(session?: TerminalSessionSummary) {
    return Boolean(
      session
        && session.projectPath === selectedProjectPath.value
        && session.tool === selectedTool.value
        && !session.resumeSessionId,
    );
  }

  async function refreshWorkspaceIndex() {
    try {
      await refreshIndex();
      await reloadWorkspace();
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    }
  }

  watch([selectedTool, refreshRevision], reloadWorkspace);
  watch(
    () => [selectedSession.value?.id, activeConversationTerminalSession.value?.id, activeConversationTerminalSession.value?.status],
    () => syncLiveSessionRefreshTimer(),
  );

  onMounted(reloadWorkspace);
  onBeforeUnmount(() => {
    stopLiveSessionRefresh();
    if (liveClockTimer) window.clearInterval(liveClockTimer);
  });

  function syncLiveSessionRefreshTimer() {
    stopLiveSessionRefresh();
    if (!selectedSession.value || activeConversationTerminalSession.value?.status !== 'running') return;
    liveSessionRefreshTimer = window.setInterval(() => {
      void refreshSelectedSessionDetail();
    }, liveSessionRefreshMs);
    void refreshSelectedSessionDetail();
  }

  function stopLiveSessionRefresh() {
    if (!liveSessionRefreshTimer) return;
    window.clearInterval(liveSessionRefreshTimer);
    liveSessionRefreshTimer = undefined;
  }

  async function refreshSelectedSessionDetail() {
    if (!selectedSession.value || refreshingLiveSession) return;
    refreshingLiveSession = true;
    const current = selectedSession.value;
    try {
      const nextSession = await api.session(current.tool, current.id);
      if (selectedSession.value?.id === current.id && selectedSession.value.tool === current.tool) {
        if (hasNewAssistantMessage(selectedSession.value, nextSession)) {
          activeConversationTerminalSessionId.value && clearLiveRun(activeConversationTerminalSessionId.value);
        }
        selectedSession.value = nextSession;
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
      stopLiveSessionRefresh();
    } finally {
      refreshingLiveSession = false;
    }
  }

  function hasNewAssistantMessage(current: SessionDetail, nextSession: SessionDetail) {
    const currentAssistantCount = current.messages.filter(isAssistantResponseMessage).length;
    const nextAssistantCount = nextSession.messages.filter(isAssistantResponseMessage).length;
    return nextAssistantCount > currentAssistantCount;
  }

  function isAssistantResponseMessage(message: SessionDetail['messages'][number]) {
    const raw = message.raw && typeof message.raw === 'object'
      ? message.raw as Record<string, unknown>
      : undefined;
    const payload = raw?.payload && typeof raw.payload === 'object'
      ? raw.payload as Record<string, unknown>
      : undefined;
    return raw?.type === 'response_item'
      && payload?.type === 'message'
      && payload?.role === 'assistant';
  }

  return {
    projects,
    sessions,
    selectedProjectPath,
    selectedProject,
    selectedSession,
    selectedTool,
    chatMessages,
    workspaceMessages,
    conversationSkills,
    activeProjectTerminalSession,
    relativeTime,
    selectedProjectName,
    refreshWorkspaceIndex,
    ...terminals,
    selectProject,
    selectSession,
    startTerminal,
    selectTerminal,
    sendChatMessage,
    closeTerminal,
  };
}

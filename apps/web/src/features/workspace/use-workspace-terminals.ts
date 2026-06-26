import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import { ElMessage } from 'element-plus';
import type {
  AiTool,
  TerminalServerMessage,
  TerminalSessionSummary,
} from '@ai-manage/shared';
import { api } from '../../api';

interface UseWorkspaceTerminalsOptions {
  /** Called after a terminal process exits so session indexes can be refreshed. */
  onTerminalExit?: (sessionId: string) => void | Promise<void>;
  /** Called when a PTY session emits output. */
  onTerminalOutput?: (sessionId: string, data: string) => void;
}

const maxOutputLength = 400_000;

/**
 * Manages multiple backend PTY sessions, websocket streams and terminal output buffers.
 */
export function useWorkspaceTerminals(options: UseWorkspaceTerminalsOptions = {}) {
  const sessions = ref<TerminalSessionSummary[]>([]);
  const outputBuffers = ref(new Map<string, string>());
  const activeSessionId = shallowRef('');
  const starting = shallowRef(false);
  const closingSessionIds = ref(new Set<string>());
  const sockets = new Map<string, WebSocket>();
  const pendingInputs = new Map<string, string[]>();

  const activeSession = computed(() =>
    sessions.value.find(session => session.id === activeSessionId.value),
  );
  const activeOutput = computed(() =>
    activeSessionId.value ? outputBuffers.value.get(activeSessionId.value) || '' : '',
  );

  function terminalOutputFor(sessionId?: string) {
    return sessionId ? outputBuffers.value.get(sessionId) || '' : '';
  }

  async function loadTerminalSessions() {
    sessions.value = await api.terminalSessions();
    for (const session of sessions.value) {
      if (session.status === 'running') connectSession(session.id);
    }
    if (!activeSessionId.value && sessions.value.length) {
      activeSessionId.value = sessions.value[0].id;
    }
  }

  async function startTerminal(tool: AiTool, projectPath: string, resumeSessionId?: string) {
    if (!projectPath) {
      ElMessage.warning('请先选择项目');
      return undefined;
    }
    starting.value = true;
    try {
      const session = await api.createTerminalSession({
        tool,
        projectPath,
        resumeSessionId,
        cols: 100,
        rows: 22,
      });
      sessions.value = [session, ...sessions.value.filter(item => item.id !== session.id)];
      activeSessionId.value = session.id;
      connectSession(session.id);
      return session;
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
      return undefined;
    } finally {
      starting.value = false;
    }
  }

  async function closeTerminal(sessionId: string) {
    const nextClosing = new Set(closingSessionIds.value);
    nextClosing.add(sessionId);
    closingSessionIds.value = nextClosing;
    try {
      await api.closeTerminalSession(sessionId);
      sockets.get(sessionId)?.close();
      sockets.delete(sessionId);
      sessions.value = sessions.value.filter(session => session.id !== sessionId);
      pendingInputs.delete(sessionId);
      removeOutput(sessionId);
      if (activeSessionId.value === sessionId) {
        activeSessionId.value = sessions.value[0]?.id || '';
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    } finally {
      const doneClosing = new Set(closingSessionIds.value);
      doneClosing.delete(sessionId);
      closingSessionIds.value = doneClosing;
    }
  }

  function selectTerminal(sessionId: string) {
    activeSessionId.value = sessionId;
    connectSession(sessionId);
  }

  function sendInput(data: string, sessionId = activeSessionId.value) {
    if (!sessionId) return false;
    const session = sessions.value.find(item => item.id === sessionId);
    if (!session || session.status !== 'running') return false;

    const socket = socketForSession(sessionId);
    if (socket) {
      socket.send(JSON.stringify({ type: 'input', data }));
      return true;
    }

    queueInput(sessionId, data);
    connectSession(sessionId);
    return true;
  }

  function resizeActive(cols: number, rows: number) {
    const socket = activeSocket();
    if (!socket) return;
    socket.send(JSON.stringify({ type: 'resize', cols, rows }));
  }

  function isClosing(sessionId: string) {
    return closingSessionIds.value.has(sessionId);
  }

  function connectSession(sessionId: string) {
    const session = sessions.value.find(item => item.id === sessionId);
    if (!session || session.status !== 'running') return;
    const existing = sockets.get(sessionId);
    if (
      existing
      && (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    const socket = new WebSocket(terminalWebSocketUrl(sessionId));
    sockets.set(sessionId, socket);
    socket.addEventListener('open', () => flushPendingInput(sessionId));
    socket.addEventListener('message', event => handleServerMessage(sessionId, event.data));
    socket.addEventListener('close', () => {
      if (sockets.get(sessionId) === socket) sockets.delete(sessionId);
    });
    socket.addEventListener('error', () => {
      appendOutput(sessionId, '\r\n[终端连接异常]\r\n');
    });
  }

  function handleServerMessage(sessionId: string, raw: unknown) {
    const message = parseServerMessage(raw);
    if (!message) return;
    if (message.type === 'output') {
      appendOutput(sessionId, message.data);
      options.onTerminalOutput?.(sessionId, message.data);
      return;
    }
    if (message.type === 'ready') {
      upsertSession(message.session);
      flushPendingInput(sessionId);
      return;
    }
    if (message.type === 'exit') {
      upsertSession(message.session);
      void options.onTerminalExit?.(sessionId);
      return;
    }
    if (message.type === 'error') {
      appendOutput(sessionId, `\r\n[${message.message}]\r\n`);
    }
  }

  function parseServerMessage(raw: unknown): TerminalServerMessage | undefined {
    try {
      return JSON.parse(String(raw)) as TerminalServerMessage;
    } catch {
      return undefined;
    }
  }

  function upsertSession(session: TerminalSessionSummary) {
    sessions.value = [
      session,
      ...sessions.value.filter(item => item.id !== session.id),
    ].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  function appendOutput(sessionId: string, data: string) {
    const next = new Map(outputBuffers.value);
    const previous = next.get(sessionId) || '';
    next.set(sessionId, `${previous}${data}`.slice(-maxOutputLength));
    outputBuffers.value = next;
  }

  function removeOutput(sessionId: string) {
    const next = new Map(outputBuffers.value);
    next.delete(sessionId);
    outputBuffers.value = next;
  }

  function activeSocket() {
    return activeSessionId.value ? socketForSession(activeSessionId.value) : undefined;
  }

  function socketForSession(sessionId: string) {
    const socket = sockets.get(sessionId);
    return socket?.readyState === WebSocket.OPEN ? socket : undefined;
  }

  function queueInput(sessionId: string, data: string) {
    const queued = pendingInputs.get(sessionId) || [];
    queued.push(data);
    pendingInputs.set(sessionId, queued);
  }

  function flushPendingInput(sessionId: string) {
    const socket = socketForSession(sessionId);
    const queued = pendingInputs.get(sessionId);
    if (!socket || !queued?.length) return;
    for (const data of queued) {
      socket.send(JSON.stringify({ type: 'input', data }));
    }
    pendingInputs.delete(sessionId);
  }

  function terminalWebSocketUrl(sessionId: string) {
    const url = new URL('/api/terminals/ws', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('sessionId', sessionId);
    return url.toString();
  }

  onBeforeUnmount(() => {
    for (const socket of sockets.values()) socket.close();
    sockets.clear();
    pendingInputs.clear();
  });

  return {
    terminalSessions: sessions,
    activeTerminalSession: activeSession,
    activeTerminalSessionId: activeSessionId,
    activeTerminalOutput: activeOutput,
    terminalOutputFor,
    terminalStarting: starting,
    loadTerminalSessions,
    startTerminal,
    closeTerminal,
    selectTerminal,
    sendInput,
    resizeActive,
    isTerminalClosing: isClosing,
  };
}

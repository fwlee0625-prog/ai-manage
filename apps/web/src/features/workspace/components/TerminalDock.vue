<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { TerminalSessionSummary } from '@ai-manage/shared';
import '@xterm/xterm/css/xterm.css';

const props = defineProps<{
  active: boolean;
  sessions: TerminalSessionSummary[];
  activeSessionId: string;
  activeOutput: string;
  currentProjectName: string;
  canStart: boolean;
  starting: boolean;
  isClosing: (sessionId: string) => boolean;
}>();

const emit = defineEmits<{
  start: [];
  refresh: [];
  select: [sessionId: string];
  close: [sessionId: string];
  input: [data: string];
  resize: [cols: number, rows: number];
}>();

const terminalElement = ref<HTMLElement>();
const activeSession = computed(() =>
  props.sessions.find(session => session.id === props.activeSessionId),
);
let terminal: Terminal | undefined;
let fitAddon: FitAddon | undefined;
let resizeObserver: ResizeObserver | undefined;
let renderedOutput = '';

function setupTerminal() {
  if (!props.active || !terminalElement.value || terminal) return;
  fitAddon = new FitAddon();
  terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 12,
    lineHeight: 1.25,
    theme: {
      background: '#111827',
      foreground: '#e5e7eb',
      cursor: '#80ed99',
      selectionBackground: '#2563eb55',
    },
  });
  terminal.loadAddon(fitAddon);
  terminal.open(terminalElement.value);
  terminal.onData(data => emit('input', data));
  fitTerminal();
}

function fitTerminal() {
  if (!props.active || !terminal || !fitAddon || !terminalElement.value?.clientWidth) return;
  fitAddon.fit();
  emit('resize', terminal.cols, terminal.rows);
}

function renderOutput(output: string) {
  if (!terminal) return;
  if (!props.activeSessionId) {
    terminal.clear();
    renderedOutput = '';
    return;
  }
  if (!output.startsWith(renderedOutput)) {
    terminal.clear();
    renderedOutput = '';
  }
  const nextChunk = output.slice(renderedOutput.length);
  if (nextChunk) terminal.write(nextChunk);
  renderedOutput = output;
}

watch(
  () => props.activeSessionId,
  async () => {
    renderedOutput = '';
    await nextTick();
    setupTerminal();
    terminal?.clear();
    renderOutput(props.activeOutput);
  },
);

watch(
  () => props.active,
  async (active) => {
    if (!active) return;
    await nextTick();
    setupTerminal();
    fitTerminal();
    renderOutput(props.activeOutput);
  },
);

watch(
  () => props.activeOutput,
  output => renderOutput(output),
);

onMounted(async () => {
  await nextTick();
  if (props.active) setupTerminal();
  resizeObserver = new ResizeObserver(fitTerminal);
  if (terminalElement.value) resizeObserver.observe(terminalElement.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  terminal?.dispose();
});
</script>

<template>
  <section class="terminal-dock">
    <header class="terminal-dock__header">
      <div class="terminal-dock__title-block">
        <span class="terminal-dock__kicker">Terminal</span>
        <strong class="terminal-dock__title">{{ currentProjectName }}</strong>
      </div>
      <div class="terminal-dock__actions">
        <el-button size="small" plain @click="emit('refresh')">刷新可视化</el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="!canStart"
          :loading="starting"
          @click="emit('start')"
        >
          启动会话
        </el-button>
      </div>
    </header>

    <div class="terminal-dock__tabs" v-if="sessions.length">
      <button
        v-for="session in sessions"
        :key="session.id"
        class="terminal-dock__tab"
        :class="{ active: session.id === activeSessionId }"
        type="button"
        @click="emit('select', session.id)"
      >
        <span class="terminal-dock__tab-name">
          {{ session.tool === 'codex' ? 'Codex' : 'Claude' }} · {{ session.projectName }}
        </span>
        <span class="terminal-dock__tab-status" :class="session.status">
          {{ session.status === 'running' ? '运行中' : '已退出' }}
        </span>
        <button
          class="terminal-dock__tab-close"
          type="button"
          :disabled="isClosing(session.id)"
          @click.stop="emit('close', session.id)"
        >
          ×
        </button>
      </button>
    </div>

    <div class="terminal-dock__body">
      <div ref="terminalElement" class="terminal-dock__terminal"></div>
      <el-empty
        v-if="!activeSession"
        class="terminal-dock__empty"
        description="选择项目后启动终端会话"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.terminal-dock {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  border: 1px solid rgb(20 32 51 / 14%);
  border-radius: var(--ds-radius-panel);
  overflow: hidden;
  background: #111827;
  box-shadow: var(--ds-shadow-panel);
}

.terminal-dock__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-space-4);
  min-height: 52px;
  padding: 10px 12px;
  border-bottom: 1px solid rgb(255 255 255 / 9%);
  background: #172033;
}

.terminal-dock__title-block {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.terminal-dock__kicker {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.terminal-dock__title {
  overflow: hidden;
  color: #f9fafb;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-dock__actions {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
}

.terminal-dock__tabs {
  display: flex;
  gap: 6px;
  min-height: 38px;
  padding: 6px 8px;
  overflow-x: auto;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
  background: #0f172a;
}

.terminal-dock__tab {
  display: inline-grid;
  grid-template-columns: minmax(120px, 1fr) auto auto;
  gap: 7px;
  align-items: center;
  max-width: 260px;
  min-height: 26px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: var(--ds-radius-control);
  padding: 3px 6px 3px 8px;
  background: rgb(255 255 255 / 5%);
  color: #cbd5e1;
  cursor: pointer;
}

.terminal-dock__tab.active {
  border-color: rgb(128 237 153 / 55%);
  background: rgb(22 130 85 / 22%);
  color: #f8fafc;
}

.terminal-dock__tab-name {
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-dock__tab-status {
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
}

.terminal-dock__tab-status.running {
  color: #86efac;
}

.terminal-dock__tab-close {
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.terminal-dock__tab-close:hover {
  background: rgb(255 255 255 / 12%);
}

.terminal-dock__body {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.terminal-dock__terminal {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 8px;
}

.terminal-dock__terminal :deep(.xterm) {
  width: 100%;
  height: 100%;
}

.terminal-dock__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: #111827;
}
</style>

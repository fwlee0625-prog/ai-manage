import { ref } from 'vue';
import type { AiTool, LogEntry } from '@ai-manage/shared';
import { api } from '../../api';
import { selectedTool } from '../../state/app-state';

export function useLogs() {
  const logs = ref<LogEntry[]>([]);

  async function loadLogs() {
    logs.value = await api.logs(selectedTool.value);
  }

  return {
    logs,
    loadLogs,
    toolLabel,
    formatTime,
  };
}

function toolLabel(tool: AiTool) {
  return tool === 'codex' ? 'Codex' : 'Claude';
}

function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

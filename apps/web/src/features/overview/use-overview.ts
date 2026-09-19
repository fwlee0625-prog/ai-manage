import { reactive } from 'vue';
import type { AiTool, RuntimeSummary, ScanStatus, ToolStatus } from '@ai-manage/shared';
import { api } from '../../api';

export function useOverview() {
  const toolStatus = reactive<ToolStatus>({ tools: [] });
  const runtimes = reactive<Partial<Record<AiTool, RuntimeSummary>>>({});

  /** Loads index/tool status and lightweight RuntimeSummary for each available tool. */
  async function loadTools() {
    const [tools, indexStatus] = await Promise.all([
      api.tools(),
      api.indexStatus(),
    ]);
    const statusesByTool = new Map(indexStatus.statuses.map(status => [status.tool, status]));
    Object.assign(toolStatus, {
      tools: tools.tools.map(tool => mergeIndexStatus(tool, statusesByTool.get(tool.tool))),
    });
    await Promise.all(toolStatus.tools.map(async tool => {
      try {
        runtimes[tool.tool] = await api.runtime(tool.tool);
      } catch {
        delete runtimes[tool.tool];
      }
    }));
  }

  return {
    toolStatus,
    runtimes,
    loadTools,
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

function mergeIndexStatus(tool: ScanStatus, status?: ScanStatus): ScanStatus {
  return status ? { ...tool, ...status, available: tool.available } : tool;
}

import { shallowRef } from 'vue';
import type { AiTool } from '@ai-manage/shared';
import { api } from '../api';
import { runWithApiFeedback } from '../shared/composables/use-api-feedback';

export const selectedTool = shallowRef<AiTool>('codex');
export const refreshing = shallowRef(false);
export const refreshRevision = shallowRef(0);
export const lastRefreshAt = shallowRef('');

/**
 * Loads the persisted last refresh time for the requested AI tool.
 */
export async function loadLastRefreshAt(tool: AiTool = selectedTool.value) {
  try {
    const indexStatus = await api.indexStatus(tool);
    if (selectedTool.value !== tool) return;

    const status = indexStatus.statuses.find(item => item.tool === tool);
    lastRefreshAt.value = status?.lastIndexedAt ?? '';
  } catch {
    if (selectedTool.value === tool) {
      lastRefreshAt.value = '';
    }
  }
}

/**
 * Refreshes the indexed data for the currently selected AI tool.
 */
export async function refreshIndex() {
  const tool = selectedTool.value;
  refreshing.value = true;
  try {
    const result = await runWithApiFeedback(
      () => api.refresh(tool),
      { success: '索引已刷新' },
    );
    if (result) {
      refreshRevision.value += 1;
      if (selectedTool.value === tool) {
        const status = result.find(item => item.tool === tool);
        lastRefreshAt.value = status?.lastIndexedAt ?? '';
      }
    }
  } finally {
    refreshing.value = false;
  }
}

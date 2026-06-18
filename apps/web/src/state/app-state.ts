import { shallowRef } from 'vue';
import type { AiTool } from '@ai-manage/shared';
import { api } from '../api';
import { runWithApiFeedback } from '../shared/composables/use-api-feedback';

export const selectedTool = shallowRef<AiTool>('codex');
export const refreshing = shallowRef(false);
export const refreshRevision = shallowRef(0);

/**
 * Refreshes the indexed data for the currently selected AI tool.
 */
export async function refreshIndex() {
  refreshing.value = true;
  try {
    const result = await runWithApiFeedback(
      () => api.refresh(selectedTool.value),
      { success: '索引已刷新' },
    );
    if (result) refreshRevision.value += 1;
  } finally {
    refreshing.value = false;
  }
}

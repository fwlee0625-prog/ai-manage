import { nextTick, onMounted, ref, watch } from 'vue';
import { Delete, Refresh, RefreshLeft } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { AiTool, TrashSessionDetail, TrashSessionFile, TrashSessionFilePreview, TrashSessionSummary } from '@ai-manage/shared';
import { api } from '../../api';
import { selectedTool } from '../../state/app-state';

export function useTrash() {
  const trashItems = ref<TrashSessionSummary[]>([]);
  const selectedTrash = ref<TrashSessionDetail>();
  const filePreview = ref<TrashSessionFilePreview>();
  const loading = ref(false);
  const restoring = ref(false);
  const deleting = ref(false);
  const clearing = ref(false);

  function toolName(tool: AiTool) {
    return tool === 'codex' ? 'Codex' : 'Claude';
  }

  function operationName(operation: TrashSessionFile['operation']) {
    return {
      'removed-file': '原文件',
      'updated-jsonl': '索引行',
      metadata: '元数据',
    }[operation];
  }

  function formatDate(value?: string) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  function formatSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  async function loadTrash() {
    loading.value = true;
    try {
      trashItems.value = await api.trashSessions(selectedTool.value);
      if (selectedTrash.value && !trashItems.value.some(item => item.trashId === selectedTrash.value?.trashId)) {
        selectedTrash.value = undefined;
        filePreview.value = undefined;
      }
    } finally {
      loading.value = false;
    }
  }

  async function selectTrash(row: TrashSessionSummary) {
    selectedTrash.value = await api.trashSession(row.trashId);
    filePreview.value = undefined;
    await nextTick();
    if (selectedTrash.value.files[0]) await loadFilePreview(0);
  }

  async function selectFile(row: TrashSessionFile) {
    if (!selectedTrash.value) return;
    const index = selectedTrash.value.files.findIndex(file => file.backupPath === row.backupPath);
    if (index >= 0) await loadFilePreview(index);
  }

  async function loadFilePreview(index: number) {
    if (!selectedTrash.value) return;
    filePreview.value = await api.trashFilePreview(selectedTrash.value.trashId, index);
  }

  async function restoreSelected() {
    if (!selectedTrash.value) return;
    const trash = selectedTrash.value;
    if (!trash.restorable) {
      ElMessage.warning('旧备份缺少原始路径，无法自动恢复');
      return;
    }
    try {
      await ElMessageBox.confirm(`确定恢复「${trash.title}」吗？`, '恢复会话', {
        type: 'warning',
        confirmButtonText: '恢复',
        cancelButtonText: '取消',
      });
    } catch {
      return;
    }

    restoring.value = true;
    try {
      await api.restoreTrashSession(trash.trashId);
      selectedTrash.value = undefined;
      filePreview.value = undefined;
      await loadTrash();
      ElMessage.success('已恢复');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    } finally {
      restoring.value = false;
    }
  }

  async function deleteSelected() {
    if (!selectedTrash.value) return;
    const trash = selectedTrash.value;
    try {
      await ElMessageBox.confirm(`确定彻底删除「${trash.title}」的备份吗？`, '彻底删除', {
        type: 'warning',
        confirmButtonText: '彻底删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      });
    } catch {
      return;
    }

    deleting.value = true;
    try {
      await api.deleteTrashSession(trash.trashId);
      selectedTrash.value = undefined;
      filePreview.value = undefined;
      await loadTrash();
      ElMessage.success('已彻底删除');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    } finally {
      deleting.value = false;
    }
  }

  async function clearTrash() {
    if (!trashItems.value.length) return;
    const tool = selectedTool.value;
    try {
      await ElMessageBox.confirm(`确定清空 ${toolName(tool)} 回收站中的 ${trashItems.value.length} 条备份吗？`, '清空回收站', {
        type: 'warning',
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      });
    } catch {
      return;
    }

    clearing.value = true;
    try {
      const result = await api.clearTrashSessions(tool);
      selectedTrash.value = undefined;
      filePreview.value = undefined;
      await loadTrash();
      ElMessage.success(`已清空 ${result.deletedCount} 条备份`);
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    } finally {
      clearing.value = false;
    }
  }

  watch(selectedTool, loadTrash);
  onMounted(loadTrash);

  return {
    trashItems,
    selectedTrash,
    filePreview,
    loading,
    restoring,
    deleting,
    clearing,
    toolName,
    operationName,
    formatDate,
    formatSize,
    loadTrash,
    selectTrash,
    selectFile,
    loadFilePreview,
    restoreSelected,
    deleteSelected,
    clearTrash,
    Delete,
    Refresh,
    RefreshLeft,
  };
}

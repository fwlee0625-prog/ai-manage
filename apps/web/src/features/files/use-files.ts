import { computed, ref, watch } from 'vue';
import type {
  ToolDirectoryListing,
  ToolFileEntry,
  ToolFilePreview,
} from '@ai-manage/shared';
import { api } from '../../api';
import { refreshRevision, selectedTool } from '../../state/app-state';

/**
 * Encapsulates file browser state, navigation, and preview loading for the PC file view.
 */
export function useFiles() {
  const listing = ref<ToolDirectoryListing>();
  const currentPath = ref('');
  const preview = ref<ToolFilePreview>();
  const loadingFiles = ref(false);
  const loadingPreview = ref(false);

  const entries = computed(() => listing.value?.entries || []);
  const parentPath = computed(() =>
    currentPath.value.split('/').slice(0, -1).join('/'),
  );
  const currentDirectoryLabel = computed(() => currentPath.value || '.');

  /**
   * Builds a stable tooltip label for file entries.
   */
  function entryPathLabel(entry: ToolFileEntry) {
    return entry.path || entry.name;
  }

  /**
   * Loads the directory contents for the active tool.
   */
  async function loadDirectory(path = '') {
    loadingFiles.value = true;
    try {
      listing.value = await api.files(selectedTool.value, path);
      currentPath.value = listing.value.path;
    } finally {
      loadingFiles.value = false;
    }
  }

  /**
   * Opens a directory and clears the current preview pane.
   */
  async function openDirectory(path: string) {
    preview.value = undefined;
    await loadDirectory(path);
  }

  /**
   * Opens a file-system entry, switching directories or loading preview data.
   */
  async function openEntry(entry: ToolFileEntry) {
    if (entry.kind === 'directory') {
      await openDirectory(entry.path);
      return;
    }
    if (entry.kind === 'symlink') {
      preview.value = {
        tool: entry.tool,
        name: entry.name,
        path: entry.path,
        size: entry.size,
        updatedAt: entry.updatedAt,
        previewType: 'unsupported',
        supported: false,
        reason: '符号链接暂不支持预览',
      };
      return;
    }

    loadingPreview.value = true;
    try {
      preview.value = await api.filePreview(selectedTool.value, entry.path);
    } finally {
      loadingPreview.value = false;
    }
  }

  /**
   * Formats byte size for table and preview labels.
   */
  function formatSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  /**
   * Formats update timestamps in the local desktop locale.
   */
  function formatTime(value?: string) {
    if (!value) return '';
    return new Date(value).toLocaleString();
  }

  watch([selectedTool, refreshRevision], () => {
    preview.value = undefined;
    loadDirectory('');
  }, { immediate: true });

  return {
    entries,
    currentPath,
    parentPath,
    preview,
    loadingFiles,
    loadingPreview,
    currentDirectoryLabel,
    entryPathLabel,
    loadDirectory,
    openDirectory,
    openEntry,
    formatSize,
    formatTime,
  };
}

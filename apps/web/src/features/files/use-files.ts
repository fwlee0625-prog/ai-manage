import { computed, ref, watch } from 'vue';
import type {
  SqliteFileOverview,
  SqliteTableRows,
  ToolDirectoryListing,
  ToolFileEntry,
  ToolFilePreview,
} from '@ai-manage/shared';
import { api } from '../../api';
import { refreshRevision, selectedTool } from '../../state/app-state';

/** File extensions that trigger the read-only SQLite table browser. */
const SQLITE_EXTENSIONS = new Set(['.sqlite', '.sqlite3', '.db', '.db3']);

/**
 * Encapsulates file browser state, navigation, and preview loading for the PC file view.
 */
export function useFiles() {
  const listing = ref<ToolDirectoryListing>();
  const currentPath = ref('');
  const preview = ref<ToolFilePreview>();
  const loadingFiles = ref(false);
  const loadingPreview = ref(false);

  const sqliteOverview = ref<SqliteFileOverview>();
  const sqliteRows = ref<SqliteTableRows>();
  const sqliteActiveTable = ref('');
  const sqlitePage = ref(1);
  const sqlitePageSize = ref(50);
  const loadingSqliteRows = ref(false);

  const entries = computed(() => listing.value?.entries || []);
  const parentPath = computed(() =>
    currentPath.value.split('/').slice(0, -1).join('/'),
  );
  const breadcrumbs = computed(() => {
    const segments = currentPath.value.split('/').filter(Boolean);
    return [
      { label: '根目录', path: '' },
      ...segments.map((label, index) => ({
        label,
        path: segments.slice(0, index + 1).join('/'),
      })),
    ];
  });

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
    resetSqliteState();
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
      resetSqliteState();
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
      if (preview.value.previewType === 'sqlite') {
        await loadSqliteOverview(entry.path);
      } else {
        resetSqliteState();
      }
    } catch (error) {
      resetSqliteState();
      preview.value = {
        tool: entry.tool,
        name: entry.name,
        path: entry.path,
        size: entry.size,
        updatedAt: entry.updatedAt,
        previewType: 'unsupported',
        supported: false,
        reason: error instanceof Error ? error.message : '预览加载失败',
      };
    } finally {
      loadingPreview.value = false;
    }
  }

  /**
   * Loads the table list of a SQLite file and opens its first table.
   */
  async function loadSqliteOverview(path: string) {
    const overview = await api.sqliteOverview(selectedTool.value, path);
    sqliteOverview.value = overview;
    sqliteRows.value = undefined;
    await selectSqliteTable(overview.tables[0]?.name || '');
  }

  /**
   * Switches the browsed table and resets pagination to the first page.
   */
  async function selectSqliteTable(name: string) {
    sqliteActiveTable.value = name;
    sqlitePage.value = 1;
    await loadSqliteRows();
  }

  /**
   * Loads one page of rows for the active SQLite table.
   */
  async function loadSqliteRows() {
    if (!sqliteActiveTable.value || !preview.value) return;
    loadingSqliteRows.value = true;
    try {
      sqliteRows.value = await api.sqliteRows(
        selectedTool.value,
        preview.value.path,
        sqliteActiveTable.value,
        sqlitePage.value,
        sqlitePageSize.value,
      );
    } finally {
      loadingSqliteRows.value = false;
    }
  }

  /**
   * Applies a page change from the SQLite data pager.
   */
  function changeSqlitePage(page: number) {
    sqlitePage.value = page;
    void loadSqliteRows();
  }

  /**
   * Applies a page size change and jumps back to the first page.
   */
  function changeSqlitePageSize(size: number) {
    sqlitePageSize.value = size;
    sqlitePage.value = 1;
    void loadSqliteRows();
  }

  /**
   * Clears cached SQLite browser state so stale tables never leak across files.
   */
  function resetSqliteState() {
    sqliteOverview.value = undefined;
    sqliteRows.value = undefined;
    sqliteActiveTable.value = '';
    sqlitePage.value = 1;
    loadingSqliteRows.value = false;
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
    resetSqliteState();
    loadDirectory('');
  }, { immediate: true });

  return {
    entries,
    currentPath,
    parentPath,
    preview,
    loadingFiles,
    loadingPreview,
    breadcrumbs,
    sqliteOverview,
    sqliteRows,
    sqliteActiveTable,
    sqlitePage,
    sqlitePageSize,
    loadingSqliteRows,
    entryPathLabel,
    loadDirectory,
    openDirectory,
    openEntry,
    selectSqliteTable,
    changeSqlitePage,
    changeSqlitePageSize,
    formatSize,
    formatTime,
  };
}

<template>
  <section class="files-page">
    <DsSplitView left-width="42%">
      <template #left>
        <DsPanel
          fill
          class="file-list-panel"
        >
          <template #header>
            <div class="file-path-header">
              <el-button
                class="file-path-header__back"
                :icon="ArrowLeft"
                :disabled="!currentPath"
                circle
                title="返回上级"
                @click="openDirectory(parentPath)"
              />
              <nav class="file-breadcrumb" aria-label="当前文件路径">
                <ElBreadcrumb separator="/">
                  <ElBreadcrumbItem
                    v-for="(item, index) in breadcrumbs"
                    :key="item.path || 'root'"
                  >
                    <button
                      v-if="index < breadcrumbs.length - 1"
                      class="file-breadcrumb__link"
                      type="button"
                      @click="openDirectory(item.path)"
                    >
                      {{ item.label }}
                    </button>
                    <span v-else class="file-breadcrumb__current">
                      {{ item.label }}
                    </span>
                  </ElBreadcrumbItem>
                </ElBreadcrumb>
              </nav>
            </div>
          </template>
          <template #actions>
            <el-button
              :icon="Refresh"
              :loading="loadingFiles"
              circle
              title="刷新"
              @click="loadDirectory(currentPath)"
            />
          </template>

          <div class="file-browser">
            <el-table
              v-loading="loadingFiles"
              :data="entries"
              height="100%"
              highlight-current-row
              row-key="path"
              @row-click="openEntry"
            >
              <el-table-column label="名称" min-width="150">
                <template #default="{ row }">
                  <div class="file-name-cell">
                    <el-icon class="file-icon">
                      <Folder v-if="row.kind === 'directory'" />
                      <Link v-else-if="row.kind === 'symlink'" />
                      <Document v-else />
                    </el-icon>
                    <el-tooltip
                      :content="entryPathLabel(row)"
                      placement="top-start"
                      :show-after="300"
                    >
                      <span class="file-name">{{ row.name }}</span>
                    </el-tooltip>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="大小" width="82">
                <template #default="{ row }">
                  <el-tooltip
                    :content="row.kind === 'directory' ? '文件夹' : formatSize(row.size)"
                    placement="top"
                    :show-after="300"
                  >
                    <span class="file-cell-text">{{
                      row.kind === "directory" ? "-" : formatSize(row.size)
                    }}</span>
                  </el-tooltip>
                </template>
              </el-table-column>
              <el-table-column label="修改时间" width="150">
                <template #default="{ row }">
                  <el-tooltip
                    :content="formatTime(row.updatedAt) || '无修改时间'"
                    placement="top"
                    :show-after="300"
                  >
                    <span class="file-cell-text">{{ formatTime(row.updatedAt) }}</span>
                  </el-tooltip>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </DsPanel>
      </template>

      <DsPanel
        fill
        class="file-preview-panel"
        :title="preview?.name || '文件预览'"
        :description="previewDescription"
      >
        <template #actions>
          <span v-if="preview" class="muted mono">{{ formatSize(preview.size) }}</span>
        </template>

        <div v-if="loadingPreview" class="preview-state">
          <el-skeleton :rows="8" animated />
        </div>
        <template v-else-if="preview">
          <img
            v-if="preview.previewType === 'image' && preview.content"
            class="image-preview"
            :src="preview.content"
            :alt="preview.name"
          />
          <div
            v-else-if="preview.previewType === 'sqlite'"
            class="sqlite-preview"
          >
            <aside class="sqlite-preview__tables">
              <div class="sqlite-preview__tables-title">
                数据表 · {{ sqliteOverview?.tables.length || 0 }}
              </div>
              <ElScrollbar class="sqlite-preview__tables-list">
                <button
                  v-for="table in sqliteOverview?.tables || []"
                  :key="table.name"
                  type="button"
                  class="sqlite-preview__table-item"
                  :class="{ 'is-active': table.name === sqliteActiveTable }"
                  @click="selectSqliteTable(table.name)"
                >
                  <el-icon class="sqlite-preview__table-icon"><Grid /></el-icon>
                  <span class="sqlite-preview__table-name">{{ table.name }}</span>
                  <el-tag
                    v-if="table.kind === 'view'"
                    class="sqlite-preview__table-kind"
                    size="small"
                    effect="plain"
                  >
                    视图
                  </el-tag>
                  <span class="sqlite-preview__table-count">{{ table.rowCount.toLocaleString() }}</span>
                </button>
                <el-empty
                  v-if="sqliteOverview && !sqliteOverview.tables.length"
                  description="该文件没有数据表"
                  :image-size="60"
                />
              </ElScrollbar>
            </aside>
            <div class="sqlite-preview__data">
              <el-table
                v-if="sqliteRows"
                v-loading="loadingSqliteRows"
                class="sqlite-preview__grid"
                :data="sqliteRows.rows"
                height="100%"
                border
                empty-text="该表没有数据"
              >
                <el-table-column
                  type="index"
                  label="#"
                  width="56"
                  fixed
                />
                <el-table-column
                  v-for="column in sqliteRows.columns"
                  :key="column.name"
                  :prop="column.name"
                  min-width="150"
                  show-overflow-tooltip
                >
                  <template #header>
                    <span class="sqlite-preview__col-header">
                      {{ column.name }}
                      <el-tag
                        v-if="column.pk"
                        size="small"
                        effect="plain"
                      >
                        PK
                      </el-tag>
                    </span>
                  </template>
                  <template #default="{ row }">
                    <span
                      class="mono"
                      :class="{ 'sqlite-preview__null': row[column.name] === null }"
                    >{{ formatSqliteCell(row[column.name]) }}</span>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty
                v-else-if="!loadingSqliteRows"
                :description="sqliteActiveTable ? '数据加载失败' : '请选择左侧数据表'"
              />
              <div
                v-if="sqliteRows"
                class="sqlite-preview__footer"
              >
                <span class="sqlite-preview__footer-total muted">
                  共 {{ sqliteRows.total.toLocaleString() }} 行
                </span>
                <el-pagination
                  background
                  layout="sizes, prev, pager, next"
                  :total="sqliteRows.total"
                  :current-page="sqlitePage"
                  :page-size="sqlitePageSize"
                  :page-sizes="[20, 50, 100, 200]"
                  @current-change="changeSqlitePage"
                  @size-change="changeSqlitePageSize"
                />
              </div>
            </div>
          </div>
          <DsCodeBlock
            v-else-if="preview.supported"
            class="file-code-preview"
            :content="preview.content"
          />
          <el-empty
            v-else
            :description="preview.reason || '暂不支持该文件类型预览'"
          />
        </template>
        <el-empty v-else description="请选择左侧文件" />
      </DsPanel>
    </DsSplitView>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  ArrowLeft,
  Document,
  Folder,
  Grid,
  Link,
  Refresh,
} from "@element-plus/icons-vue";
import { ElBreadcrumb, ElBreadcrumbItem } from 'element-plus';
import { DsCodeBlock, DsPanel, DsSplitView } from '../../components/design-system';
import { useFiles } from './use-files';

const {
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
} = useFiles();

/**
 * Describes the preview pane context above the content.
 */
const previewDescription = computed(() => {
  if (!preview.value) return '当前文件内容或图片预览';
  return preview.value.previewType === 'sqlite'
    ? 'SQLite 数据只读浏览：左侧选择表，右侧分页查看数据'
    : '当前文件内容或图片预览';
});

/**
 * Renders one SQLite cell for the data grid; NULL stays visually distinct.
 */
function formatSqliteCell(value: unknown) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
</script>

<style scoped lang="scss">
.files-page {
  min-height: 0;
}

.file-browser {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.file-path-header {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 10px;
}

.file-path-header__back {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  min-height: 26px;
  padding: 0;
}

.file-path-header__back :deep(.el-icon) {
  font-size: 12px;
}

.file-breadcrumb {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  align-items: center;
  overflow-x: auto;
}

.file-breadcrumb :deep(.el-breadcrumb) {
  display: inline-flex;
  min-width: max-content;
  align-items: center;
}

.file-breadcrumb :deep(.el-breadcrumb__separator) {
  display: inline-flex;
  margin: 0 8px;
  color: var(--ds-color-text-muted);
  font-weight: 500;
}

.file-breadcrumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__separator) {
  display: none;
}

.file-breadcrumb__link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ds-color-text-muted);
  cursor: pointer;
  font: inherit;
}

.file-breadcrumb__link:hover,
.file-breadcrumb__link:focus-visible {
  color: var(--ds-state-active-color);
  outline: none;
}

.file-breadcrumb__current {
  color: var(--ds-color-text);
  font-weight: 600;
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  cursor: pointer;
}

.file-icon {
  flex: 0 0 auto;
  color: var(--ds-color-text-muted);
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-cell-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-state,
.file-code-preview {
  flex: 1;
  min-height: 0;
}

.image-preview {
  align-self: flex-start;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border: 1px solid var(--ds-color-border);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface);
}

.sqlite-preview {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 12px;
}

.sqlite-preview__tables {
  display: flex;
  flex: 0 0 208px;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--ds-color-border);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface);
}

.sqlite-preview__tables-title {
  padding: 10px 12px;
  border-bottom: 1px solid var(--ds-color-border-soft);
  color: var(--ds-color-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.sqlite-preview__tables-list {
  flex: 1;
  min-height: 0;
}

.sqlite-preview__table-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  color: var(--ds-color-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.sqlite-preview__table-item:hover {
  background: var(--ds-color-surface-soft);
}

.sqlite-preview__table-item.is-active {
  color: var(--ds-state-active-color);
  background: var(--ds-state-active-bg);
  font-weight: 600;
}

.sqlite-preview__table-icon {
  flex: 0 0 auto;
  color: var(--ds-color-text-muted);
}

.sqlite-preview__table-item.is-active .sqlite-preview__table-icon {
  color: var(--ds-state-active-color);
}

.sqlite-preview__table-name {
  flex: 1 1 auto;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sqlite-preview__table-kind {
  flex: 0 0 auto;
}

.sqlite-preview__table-count {
  flex: 0 0 auto;
  color: var(--ds-color-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.sqlite-preview__data {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
}

.sqlite-preview__grid {
  flex: 1;
  min-height: 0;
}

.sqlite-preview__col-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sqlite-preview__null {
  color: var(--ds-color-text-muted);
  font-style: italic;
}

.sqlite-preview__footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

.sqlite-preview__footer-total {
  font-size: 12px;
  white-space: nowrap;
}
</style>

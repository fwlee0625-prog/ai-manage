<template>
  <section class="files-page">
    <DsSplitView left-width="42%">
      <template #left>
        <DsPanel
          fill
          class="file-list-panel"
          :title="currentDirectoryLabel"
          description="目录浏览与文件选择"
        >
          <template #actions>
            <el-button
              v-if="currentPath"
              :icon="ArrowLeft"
              circle
              title="返回上级"
              @click="openDirectory(parentPath)"
            />
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
        description="当前文件内容或图片预览"
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
import {
  ArrowLeft,
  Document,
  Folder,
  Link,
  Refresh,
} from "@element-plus/icons-vue";
import { DsCodeBlock, DsPanel, DsSplitView } from '../../components/design-system';
import { useFiles } from './use-files';

const {
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
} = useFiles();
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
</style>

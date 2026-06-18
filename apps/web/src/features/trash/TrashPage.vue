<script setup lang="ts">
import { DsCodeBlock, DsPanel, DsSplitView } from '../../components/design-system';
import { useTrash } from './use-trash';

const {
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
  restoreSelected,
  deleteSelected,
  clearTrash,
  Delete,
  Refresh,
  RefreshLeft,
} = useTrash();
</script>

<template>
  <section class="trash-page">
    <DsSplitView left-width="42%">
      <template #left>
        <DsPanel fill class="trash-list-panel" title="回收站" description="已删除会话的本地备份">
          <template #actions>
            <el-tag size="small">{{ trashItems.length }}</el-tag>
            <el-button
              :icon="Delete"
              type="danger"
              plain
              :disabled="!trashItems.length"
              :loading="clearing"
              @click="clearTrash"
            >
              清空回收站
            </el-button>
            <el-button :icon="Refresh" circle title="刷新" :loading="loading" @click="loadTrash" />
          </template>

          <el-table
            :data="trashItems"
            height="100%"
            row-key="trashId"
            highlight-current-row
            @row-click="selectTrash"
          >
            <el-table-column prop="title" label="会话" min-width="180" show-overflow-tooltip />
            <el-table-column prop="tool" label="工具" width="82">
              <template #default="{ row }">{{ toolName(row.tool) }}</template>
            </el-table-column>
            <el-table-column prop="deletedAt" label="删除时间" width="170">
              <template #default="{ row }">{{ formatDate(row.deletedAt) }}</template>
            </el-table-column>
            <el-table-column prop="fileCount" label="文件" width="72" />
          </el-table>
        </DsPanel>
      </template>

      <DsPanel
        fill
        class="trash-detail-panel"
        :title="selectedTrash?.title || '选择回收站项目'"
        description="查看备份文件并执行恢复或彻底删除"
      >
        <template #actions>
          <div v-if="selectedTrash" class="detail-actions">
            <el-button
              :icon="RefreshLeft"
              type="primary"
              plain
              :disabled="!selectedTrash.restorable"
              :loading="restoring"
              @click="restoreSelected"
            >
              恢复
            </el-button>
            <el-button :icon="Delete" type="danger" plain :loading="deleting" @click="deleteSelected">
              彻底删除
            </el-button>
          </div>
        </template>

        <div v-if="selectedTrash" class="trash-detail-body">
          <dl class="trash-meta">
            <div>
              <dt>工具</dt>
              <dd>{{ toolName(selectedTrash.tool) }}</dd>
            </div>
            <div>
              <dt>删除时间</dt>
              <dd>{{ formatDate(selectedTrash.deletedAt) }}</dd>
            </div>
            <div>
              <dt>项目</dt>
              <dd class="mono">{{ selectedTrash.projectPath || '-' }}</dd>
            </div>
            <div>
              <dt>备份目录</dt>
              <dd class="mono">{{ selectedTrash.backupDir }}</dd>
            </div>
          </dl>

          <div class="trash-file-grid">
            <el-table
              :data="selectedTrash.files"
              height="100%"
              row-key="backupPath"
              highlight-current-row
              @row-click="selectFile"
            >
              <el-table-column prop="name" label="备份文件" min-width="160" show-overflow-tooltip />
              <el-table-column prop="operation" label="类型" width="120">
                <template #default="{ row }">{{ operationName(row.operation) }}</template>
              </el-table-column>
            </el-table>

            <div class="trash-preview">
              <div class="preview-header">
                <span>{{ filePreview?.name || '文件预览' }}</span>
                <span v-if="filePreview" class="mono">{{ formatSize(filePreview.size) }}</span>
              </div>
              <DsCodeBlock
                v-if="filePreview?.supported"
                class="trash-code"
                :content="filePreview.content"
              />
              <el-empty v-else :description="filePreview?.reason || '请选择备份文件'" />
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无选中项目" />
      </DsPanel>
    </DsSplitView>
  </section>
</template>

<style scoped lang="scss">
.trash-page {
  min-height: 0;
}

.detail-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.trash-detail-body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.trash-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;

  div {
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--ds-color-border-soft);
    border-radius: var(--ds-radius-control);
    background: var(--ds-color-surface-soft);
  }

  dt {
    color: var(--ds-color-text-muted);
    font-size: 12px;
  }

  dd {
    margin: 4px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.trash-file-grid {
  display: grid;
  grid-template-columns: minmax(240px, 36%) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.trash-preview {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-panel);
  background: var(--ds-color-surface);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ds-color-border-soft);
  font-weight: 600;
}

.trash-code {
  border: 0;
  border-radius: 0;
}
</style>

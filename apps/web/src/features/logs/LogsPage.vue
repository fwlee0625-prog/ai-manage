<template>
  <section class="logs-page">
    <DsPanel title="运行日志" description="查看本机索引、扫描和文件操作的最近记录">
      <template #actions>
        <DsToolbar compact>
          <template #actions>
            <el-button size="small" @click="loadLogs">刷新</el-button>
          </template>
        </DsToolbar>
      </template>
      <el-table :data="logs" height="calc(100vh - 190px)">
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatTime(row.timestamp) }}</template>
        </el-table-column>
        <el-table-column prop="tool" label="工具" width="82">
          <template #default="{ row }">{{ toolLabel(row.tool) }}</template>
        </el-table-column>
        <el-table-column prop="level" label="级别" width="90" />
        <el-table-column prop="target" label="目标" min-width="180" />
        <el-table-column prop="message" label="内容" min-width="360" show-overflow-tooltip />
      </el-table>
    </DsPanel>
  </section>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { DsPanel, DsToolbar } from '../../components/design-system';
import { refreshRevision, selectedTool } from '../../state/app-state';
import { useLogs } from './use-logs';

const { logs, loadLogs, toolLabel, formatTime } = useLogs();

watch([selectedTool, refreshRevision], loadLogs);
onMounted(loadLogs);
</script>

<style scoped lang="scss">
.logs-page {
  min-height: 0;
}
</style>

<script setup lang="ts">
defineProps<{
  label: string;
  isDirty: boolean;
  hasSelectedConfig: boolean;
  loadingDetail: boolean;
}>();

const emit = defineEmits<{
  reset: [];
  reload: [];
}>();
</script>

<template>
  <div class="card-header config-detail-header">
    <div class="detail-title">
      <span>{{ label }}</span>
      <el-tag v-if="isDirty" size="small" type="warning">未保存</el-tag>
    </div>
    <div class="detail-actions">
      <el-button :disabled="!hasSelectedConfig" @click="emit('reset')">重置</el-button>
      <el-button
        :disabled="!hasSelectedConfig"
        :loading="loadingDetail"
        @click="emit('reload')"
      >
        刷新
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.config-detail-header,
.detail-title,
.detail-actions {
  display: flex;
  align-items: center;
}

.config-detail-header {
  width: 100%;
  justify-content: space-between;
  gap: 12px;
}

.detail-title {
  gap: 8px;
  min-width: 0;
  font-weight: 600;
}

.detail-actions {
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>

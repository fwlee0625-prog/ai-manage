<script setup lang="ts">
defineProps<{
  pageTitle: string;
  refreshing: boolean;
}>();

defineEmits<{
  refresh: [];
}>();
</script>

<template>
  <el-header class="app-topbar" height="72px">
    <div class="app-topbar__page-heading">
      <div class="app-topbar__page-kicker">Workspace</div>
      <div class="app-topbar__page-title">{{ pageTitle }}</div>
    </div>
    <div class="app-topbar__toolbar">
      <el-button type="primary" :loading="refreshing" @click="$emit('refresh')">
        刷新索引
      </el-button>
    </div>
  </el-header>
</template>

<style scoped lang="scss">
.app-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(14px);
}

.app-topbar__page-heading {
  display: grid;
  gap: 3px;
}

.app-topbar__page-kicker {
  color: var(--ds-color-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.app-topbar__page-title {
  font-size: 20px;
  font-weight: 700;
}

.app-topbar__toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}
</style>

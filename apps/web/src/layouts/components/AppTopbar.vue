<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  pageTitle: string;
  lastRefreshAt?: string;
  refreshing: boolean;
}>();

defineEmits<{
  refresh: [];
}>();

const lastRefreshLabel = computed(() => {
  if (!props.lastRefreshAt) return "未刷新";
  const date = new Date(props.lastRefreshAt);
  if (Number.isNaN(date.getTime())) return "未刷新";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
});
</script>

<template>
  <el-header class="app-topbar" height="72px">
    <div class="app-topbar__page-heading">
      <div class="app-topbar__page-kicker">Workspace</div>
      <div class="app-topbar__page-title">{{ pageTitle }}</div>
    </div>
    <div class="app-topbar__toolbar">
      <span class="app-topbar__refresh-time">
        最近刷新：{{ lastRefreshLabel }}
      </span>
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

.app-topbar__refresh-time {
  color: var(--ds-color-text-muted);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
</style>

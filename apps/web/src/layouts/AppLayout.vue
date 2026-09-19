<script setup lang="ts">
import { ArrowLeft, ArrowRight } from "@element-plus/icons-vue";
import { computed, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import {
  lastRefreshAt,
  loadLastRefreshAt,
  refreshIndex,
  refreshing,
  selectedTool,
} from "../state/app-state";
import AppSidebar from "./components/AppSidebar.vue";
import AppTopbar from "./components/AppTopbar.vue";

const route = useRoute();
const sidebarCollapsed = shallowRef(false);
const headerOpen = shallowRef(true);
const activePath = computed(() => route.path);
const pageTitle = computed(() => String(route.meta.title || "总览"));
const sidebarToggleIcon = computed(() =>
  sidebarCollapsed.value ? ArrowRight : ArrowLeft,
);
const sidebarToggleTitle = computed(() =>
  sidebarCollapsed.value ? "展开侧边栏" : "收起侧边栏",
);

/**
 * Applies per-route layout defaults when the active page changes.
 */
function applyRouteLayoutDefaults() {
  sidebarCollapsed.value = route.meta.sidebarOpen === false;
  headerOpen.value = route.meta.headerOpen !== false;
}

watch(() => route.name, applyRouteLayoutDefaults, { immediate: true });
watch(selectedTool, tool => loadLastRefreshAt(tool), { immediate: true });
</script>

<template>
  <el-container
    class="app-layout"
    :class="{ 'app-layout--sidebar-collapsed': sidebarCollapsed }"
  >
    <AppSidebar
      v-model:selected-tool="selectedTool"
      :active-path="activePath"
      :collapsed="sidebarCollapsed"
    />

    <el-container class="app-layout__content" direction="vertical">
      <el-button
        class="app-layout__sidebar-toggle"
        :icon="sidebarToggleIcon"
        :title="sidebarToggleTitle"
        circle
        @click="sidebarCollapsed = !sidebarCollapsed"
      />
      <AppTopbar
        v-if="headerOpen"
        :page-title="pageTitle"
        :last-refresh-at="lastRefreshAt"
        :refreshing="refreshing"
        @refresh="refreshIndex"
      />

      <el-main
        class="app-layout__main"
        :class="{ 'app-layout__main--header-hidden': !headerOpen }"
      >
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.app-layout {
  --app-header-height: 72px;
  height: 100vh;
  overflow: hidden;
  background: var(--ds-gradient-page);
}

.app-layout__content {
  position: relative;
  min-width: 0;
}

.app-layout__sidebar-toggle {
  position: absolute;
  top: 50%;
  left: -12px;
  z-index: 20;
  width: 22px;
  height: 72px;
  border-color: rgb(255 255 255 / 76%);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 90%), rgb(248 252 255 / 76%)),
    var(--ds-color-surface);
  box-shadow:
    0 10px 28px rgb(20 32 51 / 12%),
    inset 0 1px 0 rgb(255 255 255 / 72%);
  color: var(--ds-color-text-muted);
  transform: translateY(-50%);
  transition:
    left 0.24s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    background 0.18s ease;
}

.app-layout__sidebar-toggle:hover {
  border-color: var(--ds-state-active-border);
  background: var(--ds-state-active-bg);
  color: var(--ds-state-active-color);
}

.app-layout--sidebar-collapsed .app-layout__sidebar-toggle {
  left: 8px;
}

.app-layout__main {
  height: calc(100vh - var(--app-header-height));
  overflow: hidden;
  background: transparent;
}

.app-layout__main--header-hidden {
  height: 100vh;
}
</style>

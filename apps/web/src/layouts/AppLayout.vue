<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { refreshIndex, refreshing, selectedTool } from "../state/app-state";
import AppSidebar from "./components/AppSidebar.vue";
import AppTopbar from "./components/AppTopbar.vue";

const route = useRoute();
const activePath = computed(() => route.path);
const pageTitle = computed(() => String(route.meta.title || "总览"));
</script>

<template>
  <el-container class="app-layout">
    <AppSidebar v-model:selected-tool="selectedTool" :active-path="activePath" />

    <el-container direction="vertical">
      <AppTopbar
        :page-title="pageTitle"
        :refreshing="refreshing"
        @refresh="refreshIndex"
      />

      <el-main class="app-layout__main">
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

.app-layout__main {
  height: calc(100vh - var(--app-header-height));
  overflow: hidden;
  background: transparent;
}
</style>

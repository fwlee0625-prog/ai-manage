<script setup lang="ts">
import type { AiTool } from "@ai-manage/shared";
import logoUrl from "../../assets/logo.svg";

interface NavItem {
  /** Router path used by Element Plus menu navigation. */
  index: string;
  /** Visible menu label. */
  label: string;
}

defineProps<{
  activePath: string;
  collapsed?: boolean;
}>();

const selectedTool = defineModel<AiTool>("selectedTool", { required: true });

const navItems: NavItem[] = [
  { index: "/overview", label: "总览" },
  { index: "/workspace", label: "对话" },
  { index: "/providers", label: "模型与账号" },
  { index: "/configs", label: "配置管理" },
  { index: "/mcp-servers", label: "MCP 服务器" },
  { index: "/skills", label: "技能管理" },
  { index: "/files", label: "文件浏览" },
  { index: "/sessions", label: "历史会话" },
  { index: "/trash", label: "回收站" },
  { index: "/logs", label: "运行日志" },
];
</script>

<template>
  <el-aside
    :width="collapsed ? '0px' : '232px'"
    class="app-sidebar"
    :class="{ 'app-sidebar--collapsed': collapsed }"
  >
    <div class="app-sidebar__inner">
      <div class="app-sidebar__brand">
        <img class="app-sidebar__brand-mark" :src="logoUrl" alt="AI Manage" />
        <div class="app-sidebar__brand-copy">
          <div class="app-sidebar__tool-select-wrapper">
            <el-select
              v-model="selectedTool"
              class="app-sidebar__tool-select"
              placeholder="选择工具"
            >
              <el-option value="codex" label="Codex AI" />
              <el-option value="claude" label="Claude AI" />
            </el-select>
          </div>
        </div>
      </div>

      <slot name="content">
        <el-menu :default-active="activePath" router class="app-sidebar__nav">
          <el-menu-item
            v-for="item in navItems"
            :key="item.index"
            :index="item.index"
          >
            {{ item.label }}
          </el-menu-item>
        </el-menu>
      </slot>
    </div>
  </el-aside>
</template>

<style scoped lang="scss">
.app-sidebar {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 52%), rgb(247 251 255 / 34%)),
    rgb(255 255 255 / 22%);
  box-shadow:
    inset -1px 0 0 rgb(255 255 255 / 58%),
    18px 0 42px rgb(20 32 51 / 7%);
  backdrop-filter: blur(22px) saturate(1.35);
  -webkit-backdrop-filter: blur(22px) saturate(1.35);
  transition:
    width 0.24s ease,
    box-shadow 0.24s ease,
    opacity 0.2s ease;
}

.app-sidebar::before {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgb(255 255 255 / 34%) 0%, transparent 36%),
    linear-gradient(180deg, rgb(128 237 153 / 10%), transparent 28%);
  pointer-events: none;
  content: "";
}

.app-sidebar--collapsed {
  box-shadow: none;
  opacity: 0;
  pointer-events: none;
}

.app-sidebar__inner {
  width: 232px;
  min-width: 232px;
}

.app-sidebar__brand {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 12px;
  align-items: center;
  box-sizing: border-box;
  height: var(--app-header-height);
  padding: 0 18px;
  background: rgb(255 255 255 / 24%);
}

.app-sidebar__brand-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.app-sidebar__tool-select-wrapper {
  display: flex;
  gap: 10px;
  align-items: center;
}

.app-sidebar__tool-select-wrapper :deep(.el-select__wrapper) {
  padding: 0;
  background-color: transparent;
  box-shadow: none;
}

.app-sidebar__tool-select-wrapper :deep(.el-select__wrapper:hover) {
  box-shadow: none;
}

.app-sidebar__tool-select-wrapper :deep(.el-select__selected-item) {
  font-size: 16px;
  font-weight: 600;
}

.app-sidebar__tool-select {
  width: 126px;
}

.app-sidebar__tool-select :deep(.el-select__wrapper) {
  min-height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.app-sidebar__tool-select :deep(.el-select__wrapper:hover),
.app-sidebar__tool-select :deep(.el-select__wrapper.is-focused) {
  box-shadow: none;
}

.app-sidebar__tool-select :deep(.el-select__selected-item),
.app-sidebar__tool-select :deep(.el-select__placeholder) {
  color: var(--ds-color-text-muted);
  font-size: 13px;
  font-weight: 600;
}

.app-sidebar__tool-select :deep(.el-select__caret) {
  color: var(--ds-color-text-muted);
}

.app-sidebar__brand-mark {
  width: 38px;
  height: 38px;
  border-radius: var(--ds-radius-feature);
  box-shadow:
    0 10px 22px rgb(87 204 153 / 28%),
    inset 0 1px 0 rgb(255 255 255 / 46%);
  object-fit: cover;
}

.app-sidebar__nav {
  position: relative;
  z-index: 1;
  border-right: 0;
  padding: 16px 12px;
  background: transparent;
}

.app-sidebar__nav :deep(.el-menu-item) {
  height: 40px;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: var(--ds-radius-control);
  color: var(--ds-color-text-muted);
  font-weight: 600;
  transition:
    background-color 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease;
}

.app-sidebar__nav :deep(.el-menu-item:hover),
.app-sidebar__nav :deep(.el-menu-item.is-active) {
  border-color: var(--ds-state-active-border);
  background: var(--ds-state-active-bg);
  box-shadow: none;
  color: var(--ds-state-active-color);
}

.app-sidebar__nav :deep(.el-menu-item.is-active)::before {
  position: absolute;
  left: 8px;
  width: 3px;
  height: 18px;
  border-radius: 999px;
  background: var(--ds-gradient-brand);
  content: "";
}
</style>

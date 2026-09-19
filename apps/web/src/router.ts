import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import AppLayout from "./layouts/AppLayout.vue";

declare module "vue-router" {
  interface RouteMeta {
    /** Page title rendered by the desktop layout header. */
    title?: string;
    /** Whether the desktop sidebar is opened by default for this route. */
    sidebarOpen?: boolean;
    /** Whether the desktop header area is opened by default for this route. */
    headerOpen?: boolean;
  }
}

/** Routes that share the desktop management layout shell. */
const managedConsoleRoutes: RouteRecordRaw[] = [
  {
    path: "overview",
    name: "overview",
    component: () => import("./features/overview/OverviewPage.vue"),
    meta: { title: "总览", sidebarOpen: true, headerOpen: true },
  },
  {
    path: "workspace",
    name: "workspace",
    component: () => import("./features/workspace/WorkspacePage.vue"),
    meta: { title: "对话", sidebarOpen: false, headerOpen: false },
  },
  {
    path: "providers",
    name: "providers",
    component: () => import("./features/providers/ProvidersPage.vue"),
    meta: { title: "模型与账号", sidebarOpen: true, headerOpen: true },
  },
  {
    path: "configs",
    name: "configs",
    component: () => import("./features/configs/ConfigsPage.vue"),
    meta: { title: "配置管理", sidebarOpen: true, headerOpen: true },
  },
  {
    path: "mcp-servers",
    name: "mcp-servers",
    component: () => import("./features/mcp-servers/McpServersPage.vue"),
    meta: { title: "MCP 服务器", sidebarOpen: true, headerOpen: true },
  },
  {
    path: "skills",
    name: "skills",
    component: () => import("./features/skills/SkillsPage.vue"),
    meta: { title: "技能管理", sidebarOpen: true, headerOpen: true },
  },
  {
    path: "files",
    name: "files",
    component: () => import("./features/files/FilesPage.vue"),
    meta: { title: "文件浏览", sidebarOpen: true, headerOpen: true },
  },
  {
    path: "sessions",
    name: "sessions",
    component: () => import("./features/sessions/SessionsPage.vue"),
    meta: { title: "历史会话", sidebarOpen: true, headerOpen: true },
  },
  {
    path: "trash",
    name: "trash",
    component: () => import("./features/trash/TrashPage.vue"),
    meta: { title: "回收站", sidebarOpen: true, headerOpen: true },
  },
  {
    path: "logs",
    name: "logs",
    component: () => import("./features/logs/LogsPage.vue"),
    meta: { title: "运行日志", sidebarOpen: true, headerOpen: true },
  },
];

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: AppLayout,
    redirect: "/overview",
    children: managedConsoleRoutes,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

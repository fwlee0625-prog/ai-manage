import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import AppLayout from './layouts/AppLayout.vue';

/** Routes that share the desktop management layout shell. */
const managedConsoleRoutes: RouteRecordRaw[] = [
  {
    path: 'overview',
    name: 'overview',
    component: () => import('./features/overview/OverviewPage.vue'),
    meta: { title: '总览' },
  },
  {
    path: 'configs',
    name: 'configs',
    component: () => import('./features/configs/ConfigsPage.vue'),
    meta: { title: '配置管理' },
  },
  {
    path: 'skills',
    name: 'skills',
    component: () => import('./features/skills/SkillsPage.vue'),
    meta: { title: '技能管理' },
  },
  {
    path: 'files',
    name: 'files',
    component: () => import('./features/files/FilesPage.vue'),
    meta: { title: '文件浏览' },
  },
  {
    path: 'sessions',
    name: 'sessions',
    component: () => import('./features/sessions/SessionsPage.vue'),
    meta: { title: '历史会话' },
  },
  {
    path: 'trash',
    name: 'trash',
    component: () => import('./features/trash/TrashPage.vue'),
    meta: { title: '回收站' },
  },
  {
    path: 'logs',
    name: 'logs',
    component: () => import('./features/logs/LogsPage.vue'),
    meta: { title: '运行日志' },
  },
];

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    redirect: '/overview',
    children: managedConsoleRoutes,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

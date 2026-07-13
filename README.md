# AI Manage

本项目是一个本机只读的 AI 工具配置与历史会话可视化管理站。

## Apps

- `apps/api`: NestJS 后端，只绑定 `127.0.0.1`，读取 `~/.codex` 与 `~/.claude`，并把派生索引写入本项目 `.data/index.sqlite`。
- `apps/web`: Vue 3 + Vite + Element Plus + Sass 的 PC 前端管理台。
- `apps/mobile`: 预留移动端查看应用位置，后续使用 Vue 3 + Vant 或轻量移动端组件实现。
- `packages/shared`: 前后端共享 TypeScript 类型。

## Data Model

- `GET /api/projects` 返回项目聚合列表，来自本地索引库中的全量会话记录。
- `GET /api/sessions` 只返回分页会话明细，支持 `tool`、`projectPath`、`keyword` 等筛选。
- `GET /api/skills/local` 返回跨 Codex、Claude 聚合的本地收藏技能；`POST`/`DELETE /api/skills/:id/favorite` 将完整技能目录加入或移出 `.data/local-skills`。
- 左侧项目树不要直接用分页会话数组聚合，避免只显示当前页的数据。
- 点击项目后，再带 `projectPath` 去请求会话列表。

## Architecture Notes

- PC 端和移动端分应用实现，不在 `apps/web` 里强行兼容移动端。
- `apps/web` 只写 PC 管理台交互，允许使用 Element Plus 的表格、分栏、抽屉等桌面组件。
- `apps/web` 已开始用 Sass 管理全局和 shell 样式，后续页面样式会继续往 SCSS 收束。
- 移动端能力后续放在 `apps/mobile`，面向手机列表、详情页、下拉刷新、底部操作栏等交互重新组织页面。
- 后端 API、共享类型、数据格式不能绑定某一个前端应用。
- 新增可复用的业务方法时，优先做成纯函数或 API client 方法，避免直接依赖 Element Plus、Vant、DOM 或具体页面状态。
- 架构路线与阶段执行记录见 [docs/architecture-roadmap.md](docs/architecture-roadmap.md)。

## Reuse Rules

- 跨端共享类型放在 `packages/shared`。
- 跨端共享 API 调用、格式化方法、查询参数构造、列表数据适配，后续可抽到 `packages/client` 或 `packages/shared` 的纯工具模块。
- 只被 PC 页面使用的展示逻辑放在 `apps/web/src`。
- 只被移动端使用的展示逻辑放在 `apps/mobile/src`。
- 后端只返回结构化数据，不返回面向某个 UI 组件的字段结构。

## Scripts

```bash
pnpm install
pnpm build
pnpm dev:api
pnpm dev:web
```

后端默认端口 `3001`，前端默认端口 `5173`。

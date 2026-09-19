# 项目开发约定

## 基本定位

- 本项目是本机只读的 AI 工具配置与历史会话可视化管理站。
- 后端使用 NestJS，前端 PC 管理台使用 Vue 3 + Element Plus。
- 后续移动端查看应用单独放在 `apps/mobile`，不要把移动端体验硬塞进 `apps/web`。

## 应用边界

- `apps/api`: 后端 API，只读扫描 `~/.codex`、`~/.claude`，派生索引只写本项目 `.data/index.sqlite`。
- `apps/web`: PC 管理台，允许使用 Element Plus 的桌面组件和 PC 布局。
- `apps/mobile`: 移动端查看应用预留目录，后续优先使用 Vue 3 + Vant 或轻量移动端组件。
- `packages/shared`: 前后端、跨端共享类型和纯工具。

## 开发规范

- 新增的代码按照 jsDoc 的语法做好注释。
- 开发过程中有属于公共的完善响应文档。

## 复用规则

- 新增功能方法时，先判断是否会被 PC 和移动端共同使用。
- 跨端共享的类型、查询参数、数据适配、格式化逻辑，必须写成不依赖 UI 组件的纯函数。
- 项目列表使用后端 `GET /api/projects` 的全量索引聚合结果；不要在前端用当前分页的 `sessions.items` 临时聚合项目。
- 对话列表使用 `GET /api/sessions`，点击项目后带精确 `projectPath` 查询该项目下的分页会话。
- 不要在共享方法里引用 Element Plus、Vant、浏览器 DOM、Vue 组件实例或页面级状态。
- PC 独有的表格列、分栏、抽屉、Element Plus 交互放在 `apps/web/src`。
- 移动端独有的列表、详情页、底部操作栏、Vant 交互放在 `apps/mobile/src`。
- 后端接口返回结构化业务数据，不返回绑定 `el-table`、Vant List 等 UI 组件的专用结构。

## 本地验证

- 需要浏览器验证时，优先访问用户已经启动的 localhost。
- 不要自行启动项目做浏览器验收；如果服务未启动，先询问用户。
- 常规代码验证优先运行：

```bash
pnpm check
pnpm test
pnpm build
```

## 安全边界

- 原始 AI 工具目录默认只读，不允许通过普通业务逻辑直接修改 `~/.codex` 或 `~/.claude`。
- 只有明确白名单配置文件允许受控写入。
- 所有写操作必须经过 PathGuard 等路径校验入口。
- 高风险认证文件使用独立写入入口，不与普通配置编辑混用。
- 写入前必须创建 backup 或 snapshot。
- 写入后必须执行必要验证；失败时需要支持恢复。
- 敏感内容按当前产品要求原样展示，不做默认脱敏；不要额外上传、同步或外发这些内容。

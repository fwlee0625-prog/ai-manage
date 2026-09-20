# AI Manage 架构路线图

## 目标

把当前项目从“可用的本机工具原型”推进为“适合中型开源协作的 local-first 管理站”。

核心原则：

- 默认本机访问，默认安全。
- 读操作优先，写操作必须有白名单、冲突校验和备份。
- 后端按领域拆分，前端按 feature 拆分。
- 跨端复用逻辑只放纯函数和无 UI 的 client 包。

## 现状问题

1. 后端路由和业务集中在少数 service/controller 中，后续扩展会越来越难维护。
2. `packages/shared` 已经承载了太多职责，类型、查询、格式化、聚合函数都挤在一个出口里。
3. 索引在启动时同步刷新，规模上来后会拖慢启动并放大失败面。
4. SQLite 访问层偏薄，迁移、事务和并发保护都不够正规。
5. 前端 API 调用散在页面里，未来 mobile 很容易重复实现。
6. 文档仍偏“只读”叙述，但实际已有配置编辑、Skill 编辑、删除和恢复会话。

## 分阶段执行

### Phase 1: 抽出跨端 client

状态：已完成

- 新增 `packages/client`，集中放 API request 和 endpoint 封装。
- `apps/web` 只保留薄转发，不再直接承载 API 细节。
- 保持现有 `/api/*` 路径不变，避免破坏当前页面。

验收标准：

- web 侧仍可正常调用全部现有接口。
- API 调用逻辑可以被 future mobile 直接复用。

### Phase 2: 拆后端领域模块

状态：进行中

- 拆分 `configs`、`skills`、`sessions`、`projects`、`files`、`trash`、`logs`。
- controller 只做路由，service 只做领域编排。
- 适配器只保留工具差异，不再包揽所有共享逻辑。
- 已完成 controller 分组。
- 已抽出 `tools`、`index refresh`、`projects`、`sessions`、`logs` 服务。
- 已抽出 `configs`、`skills`、`files` 服务。
- 已删除旧的聚合型 `AiToolsService`。

验收标准：

- 单个 service 文件不再承载全部业务。
- 新增一种 AI 工具时只需要接入适配器层。

### Phase 3: 索引与数据库正规化

状态：进行中

- 增加索引状态接口。
- 把启动时全量刷新改成显式刷新与状态恢复。
- 为数据库层补迁移和事务 helper。
- 已新增 `GET /api/index/status` 和跨端 client 调用。
- 已移除服务启动时的自动全量刷新，刷新改为显式调用 `POST /api/index/refresh`。
- 已为索引库引入 `schema_migrations` 和版本化迁移骨架。
- 已为会话批量替换引入事务 helper。
- 已集中索引查询 SQL helper，减少 repository 内散落条件拼接。
- 已将 SQLite 访问从外部 `sqlite3` CLI 切换为 Node 内置 `node:sqlite` 封装。

验收标准：

- 启动不会因为全量扫描而阻塞。
- 索引状态可被 UI 明确展示。

### Phase 4: 前端 feature 化

状态：已完成

- 页面逻辑下沉到 `features/*/use-*.ts`。
- 公共确认框、错误处理、刷新逻辑抽成共享层。
- 本轮不处理移动端，只推进 PC 前端 feature 化。
- 已引入 Sass，并把 App Shell 拆成独立组件。
- 已迁移 `overview` 和 `logs` 到 `features/*`，并抽出 `use-overview`、`use-logs`。
- 已迁移 `skills` 和 `trash` 到 `features/*`，并抽出 `use-skills`、`use-trash`。
- 已迁移 `sessions` 到 `features/sessions`，并抽出 `use-sessions`。
- 已迁移 `files` 到 `features/files`，并抽出 `use-files`。
- 已迁移 `configs` 到 `features/configs`，并抽出 `use-configs`。
- 已将 `configs` 继续拆成菜单、头部、元信息、编辑区等 PC 子组件。
- 已改成路由懒加载，减少首屏主入口体积。
- 已将 Element Plus 改为按需注册，避免把整套 UI 库直接挂到入口实例上。
- `apps/web/src/router.ts` 已全部指向 `features/*` 路由页，`apps/web/src/views` 当前已清空。

验收标准：

- 页面文件更轻，主要负责布局和组合。
- 共享逻辑不再依赖 Element Plus 或页面状态。

## 当前优先级

1. 继续抽公共反馈、确认框和错误处理能力，减少 feature composable 的 UI 反馈重复。
2. 视需要再拆更细的通用表单组件，但不影响当前交付。
3. 如后续引入更多 Element Plus 能力，再继续做按需注册补齐。

## 最新验收记录

- `pnpm check`：通过。
- `pnpm test`：通过，7 个后端测试文件、20 条测试全部通过。
- `pnpm build`：通过；仅保留第三方 `@vueuse/core` pure annotation warning，无业务侧 chunk 警告。

## Shared 拆分记录

- 已将 `packages/shared` 拆成 `contracts/*` 和 `formatters/*`。
- 根出口 `@ai-manage/shared` 保持兼容，现有调用无需迁移。
- 后续新增共享类型必须放到对应领域文件，不再堆到根 `index.ts`。


## 模型与账号领域（2026-09）

模型切换已经从“配置管理中的一组表单”迁移为独立领域：

- `manage.sqlite` 保存 Provider、managed account、active profile 与 switch history；live 配置不再作为 Provider SSOT。
- `providers` 负责 Provider/Preset/Credential 生命周期，Secret 不进入列表 DTO。
- `accounts` 负责 Codex ChatGPT managed OAuth 多账号与独立 OAuth Secret Store。
- `runtime` 负责 tool 级锁、snapshot、projection、atomic write、verify、rollback 和 active profile commit。
- RuntimeDetector 对比 managed state 与实际 live，区分 `synced`、`externally_modified`、`unmanaged`、`auth_invalid`、`reauth_required`。
- 模型与账号页面是普通用户的主入口；配置管理只保留高级配置编辑和跳转入口。
- live 写入仍遵守 PathGuard 白名单、高风险 auth 独立入口、snapshot/backup、写后验证和失败恢复。
- 外部修改不会被后台静默覆盖；用户可以选择采用当前 live，或通过 SwitchService 恢复 AI Manage 托管状态。

### 写权限边界

允许修改的 live 文件仍然是明确白名单，而不是整个工具目录。Provider 切换涉及的 Codex `config.toml` / `auth.json` 与 Claude `settings.json` 必须经过 Runtime 写入链路；其它工具数据继续遵守原有只读或专用写入口。

### 当前模型切换职责

```text
Managed Provider / Account
          ↓
     SwitchService
          ↓
      Projection
          ↓
 Snapshot → Atomic Writer → Verify
          ↓                 ↓
       Rollback        active_profiles
```

旧的 Configs Provider CRUD 与公开 Codex auth API Key patch 路径已经退出主流程。

### Phase 6 体验增强

- App Sidebar 增加轻量 Runtime 快速切换，显示当前 Provider、账号/模型摘要与最近使用 Provider。
- 快速切换只消费 Provider/Runtime API，并统一走 SwitchService，不复制完整 Provider 管理能力到 App Shell。
- Overview 直接消费 RuntimeSummary 展示每个工具当前 Provider、模型、账号和同步状态。
- Provider 顺序由 manage.sqlite 的 sort_index 持久化；复制默认不复制 Secret。
- Provider 健康检查区分 healthy、auth_error、unreachable、invalid_config；native login 保持 unknown，避免一次临时网络错误形成永久错误状态。

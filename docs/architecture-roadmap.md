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

- `pnpm check`：通过（4 个 workspace 包）。
- `pnpm test`：通过，22 个后端测试文件、69 条测试全部通过。
- `pnpm build`：通过；仅保留第三方 `@vueuse/core` pure annotation warning 与 vendor chunk size warning。

### 2026-09-20 模型与账号页面修复轮

上一轮记录的 `check/test 通过` 与真实结果不符，本轮按实际输出重新验收：

- `plugins/element-plus.ts` 按需注册缺 `ElCheckbox / ElDialog / ElForm / ElPopover / ElStep / ElSteps`，导致侧栏快速切换、Provider 抽屉凭据区、账号设备登录弹窗整体不渲染。已补齐，并新增 `apps/web/scripts/check-element-plus-registrations.mjs` 挂进 `check` / `test` 防回归。
- `packages/client/dist` 停留在 7/13 产物，不含 providers / runtime / accounts 接口；Vite dev 直接加载它，`/providers` 首屏取数静默失败，而 `check/test` 因类型走 `src` 而照样通过。已重建，并让 `apps/web` 的 `dev` 脚本先构建 `shared` 与 `client`。
- Codex 官方原生登录（config.toml 无 `model_provider` / `model_providers`）此前既导入不出候选、也无法被 RuntimeDetector 匹配，“导入当前配置”和“采用当前状态”恒失败。现在会把这种隐式官方态识别为一个 `openai` native_login Provider。
- Provider 创建时若带 API Key 但未显式指定 `authMode`，凭据会被静默丢弃；现在按 `api_key` 推断。
- 请求失败不再把 NestJS 原始 JSON 信封抛给用户，`packages/client` 统一提取可读 `message`。
- Runtime 同步状态、认证模式与切换时间改为经 `packages/shared` 的 `formatters/runtime.ts` 输出中文标签，Overview / 快速切换 / Provider 卡片不再露出 `unmanaged`、`native_login` 和裸 ISO 时间。
- `features/configs/components/ModelProviderManager.vue` 是 Phase 5 遗留的孤立组件，引用了已删除的 `use-configs` 类型而使 `vue-tsc` 失败。已确认新页面完全替代，随本次修复一并删除。
- 删除该组件后重新执行 `pnpm check` / `pnpm test` / `pnpm build`，三者退出码均为 0；`/providers` 与 Overview、Configs、Sessions、Files 在浏览器中复测渲染正常、控制台无 error 与 Vue warning。
- Provider 卡片移除「上移 / 下移」按钮，`ProviderCard` 的 `moveUp/moveDown`、`ProviderGrid` 的 `reorder`、`ProvidersPage` 与 `use-providers` 的对应处理一并删除。后端 `PATCH /api/providers/reorder` 与 `sort_index` 保留，Provider 顺序目前由创建 / 导入顺序决定。
- 「当前运行环境」大卡片从 `/providers` 移除，同步状态与账号/模型摘要改由顶栏、侧栏快速切换承载。「采用当前状态」「恢复 AI Manage 配置」两个修复入口迁入「供应商」工具条，仅在 `syncStatus` 异常时出现；卡内原有的「刷新」按钮随之去掉，需要重新探测时刷新页面即可。`components/CurrentRuntimeCard.vue` 已无代码引用，待确认后再删。
- 添加 / 编辑 Provider 抽屉的 `Endpoint` 标签改为「接口地址」，与投影目标（Codex `base_url`、Claude `ANTHROPIC_BASE_URL`）语义对齐。
- `ModelPicker` 由 `el-select + allow-create` 改为 `el-autocomplete`。原实现在上游取不到模型列表时无法可靠提交自定义模型名（新建项在 blur / 列表刷新后丢失，保存下来 `defaultModel` 为空），且候选列表从不包含当前值。现在模型名始终是自由文本，`获取模型` 只作为建议来源，按输入做不区分大小写过滤。
- 运行时账号摘要在没有邮箱时显示 Codex 的账户 ID（UUID）。按“敏感内容原样展示、不做默认脱敏”的产品要求保留，不视为缺陷。
- 页面文案统一把 `Provider` 称为「供应商」，共 17 条文案、19 处字样：`ProvidersPage` 说明与导入提示、`ProviderDrawer`（标题 / 供应商类型）、`ProviderGrid` 空态、`use-providers` 的提示与确认（已保存 / 已复制 / 删除确认 / 已删除）、`QuickRuntimeSwitcher`（点击提示、未识别供应商、最近供应商、暂无供应商）、`RuntimeQuickSwitch` 空态、`AccountCenterDrawer` 说明、`DeviceLoginDialog` 授权成功提示、`ConfigEditorSections` 模型配置说明。类型名、组件名、字段与接口标识符不变，仅中文标签替换；代码注释里的 `Provider` 保留，因为它指代领域类型而非界面文案。
- 改名后重跑 `pnpm check` / `pnpm test` / `pnpm build`，退出码分别为 0 / 0 / 0（22 个测试文件、69 条测试全通过）。浏览器复测 `/providers`、供应商抽屉、账号中心抽屉、顶栏快速切换、`/configs` 模型配置分组，整页文本已无 `Provider` 字样，控制台无 error 与 warning。
- Provider 卡片上的 `<dt>Endpoint</dt>` 仍是英文，与抽屉的「接口地址」不一致；本轮只按要求改抽屉，卡片标签待产品确认后再统一。抽屉里的 `Preset` 标签同理。
- 供应商连通性测试结果改用 `ElNotification`（右上角，`duration: 3000` 自动关闭），标题为「<供应商名> 连通性测试」、正文为后端 `message`，成功 `success` / 失败 `warning` / 请求异常 `error`，替代原先的 `ElMessage` 轻提示。同时给「测试」按钮补上 `testingId` 的 loading 与重入保护，避免连点产生并发探测。
- 页面顶部 `ProviderTestResult` 的常驻 alert 与通知作用重复，已从 `/providers` 撤下：`ProvidersPage` 不再引用该组件，`use-providers` 也删掉了 `testResult` 状态（连带 `openCreate/openEdit` 的重置与 `ProviderTestResponse` 类型导入）。健康标签仍由 `healthById` 驱动，卡片上的「健康 / 认证异常」不受影响。`components/ProviderTestResult.vue` 自此无引用，与 `CurrentRuntimeCard.vue` 一并等待删除确认。
- 撤下后重跑 `pnpm check` / `pnpm test` / `pnpm build`，退出码 0 / 0 / 0；浏览器实测：进入 `/providers` 顶部无 alert，点「测试」后按钮进入 loading，只有右上角通知出现（`position: fixed`，`x=1145, y=16, 330×84`，`opacity: 1`），存活约 3.4s（含淡出过渡）后自动消失，通知关闭后页面仍无常驻 alert，卡片健康标签正常刷新，控制台无 error 与 warning。
- 预设供应商补齐智谱 GLM / Kimi / MiniMax 三家，Codex 与 Claude 各一条：Codex 走 OpenAI 兼容端点 + `responses`（`https://open.bigmodel.cn/api/paas/v4`、`https://api.moonshot.cn/v1`、`https://api.minimax.cn/v1`），Claude 走各家 Anthropic 兼容端点 + `anthropic`（`.../api/anthropic`、`.../anthropic`、`.../anthropic`）。端点取自各家当日官方文档；智谱另有 Coding 套餐专用 `/api/coding/paas/v4`，预设用通用端点，用户可在「接口地址」改。
- `ProviderPreset` 契约新增可选 `icon` 键（`packages/shared/src/contracts/providers.ts`）。图标取自 cc-switch（MIT，`src/icons/extracted`）的 7 个品牌 SVG，落在 `apps/web/src/assets/provider-icons/`，每个文件头部保留来源与许可证署名；`?raw` 导入后由 `features/providers/provider-icons.ts` 按 key 索引，`ProviderPresetPicker` 用内联 SVG 渲染，因此 `currentColor` 的单色图标（OpenAI / Anthropic / OpenRouter）会跟随文字颜色。无 `icon` 的自定义预设退化为名称首字母圆形占位。
- 新增后端断言：两家工具都必须含 `zhipu / kimi / minimax` 预设，且端点、协议、`authMode` 与 `icon` 匹配。`pnpm check` / `test` / `build` 退出码 0 / 0 / 0（22 文件 70 测试）；浏览器实测 Codex 预设网格 7 项全部带图标（自定义项为首字母占位），点「智谱 GLM」正确回填名称 / 类型 / 接口地址 / 协议，`GET /api/providers/presets?tool=claude` 返回三家 Anthropic 端点，控制台无 error 与 warning。
- 遗留：既有 `deepseek` 的 Claude 预设端点仍是 `https://api.deepseek.com`，而 DeepSeek 的 Anthropic 兼容路径是 `/anthropic`，本轮未改动，待确认后统一。

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

## 用量统计领域（2026-09）

新增侧边栏「用量统计」页（`/statistics`），按项目 / 会话维度展示 Token 用量与工具调用统计。数据链路与口径如下：

- 数据源为原始会话文件，扫描时顺带提取：Codex 取 rollout jsonl 中 `token_count` 事件的**累计快照**（最后一个非 null 值，不逐事件求和），工具调用按 `function_call` / `custom_tool_call` 计数，模型取最后一个 `turn_context`；rollout 缺失时退回 Codex state 库 `threads.tokens_used`（仅总量）。Claude 对 `projects/**/*.jsonl` 全量单遍扫描，逐条累加 assistant 行 `message.usage`（input / cache_read / cache_creation / output，total 为四项之和），工具调用按 `tool_use` 内容块计数，`isSidechain` 子代理流量计入。
- 索引库 `index.sqlite` 新增迁移 v2 `add-session-usage-columns`：`sessions` 表增加 input_tokens / cache_read_tokens / cache_write_tokens / output_tokens / total_tokens / tool_call_count / tool_calls_json / model 八列。旧索引数据默认为 0，需在页面点一次「刷新索引」填充。
- 两个 adapter 的扫描改为 `mapWithLimit`（并发 32）全量读文件，避免大量会话一次性打开过多文件句柄；Claude 侧顺带修正了此前 `readJsonl(file, 80) + countJsonl` 的双遍扫描。
- 新端点：`GET /api/stats/overview`（总览，由项目级聚合归约）、`GET /api/stats/projects`（项目用量，按总 Token 降序）、`GET /api/stats/daily`（按日趋势，会话用量按 `updated_at` 归入当天，days 夹取 1~180）。共享契约在 `packages/shared/src/contracts/statistics.ts`，格式化（`formatTokenCount` / `usageSegments` / `sortToolCallBreakdown`）在 `formatters/usage.ts`，均为无 UI 依赖的纯函数。
- 前端 `features/statistics`：`apps/web` 新增 echarts 依赖并按需注册（Line / Pie / Grid / Tooltip / Legend / Canvas）；页面含总览指标卡、按日堆叠面积图、工具调用环形图、项目用量列表（Token 构成比例条）与会话明细表（可排序、展开看工具调用分布）。会话明细复用 `GET /api/sessions` 按 `projectPath` 精确查询。
- 口径说明：Codex `input_tokens` 含缓存命中、Claude 不含，页面文案与 `usageSegments` 已分别处理；按日趋势按会话最后更新时间归日，属已知简化（索引无逐轮时间戳）。

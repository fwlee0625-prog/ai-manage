# 模型与账号切换实施计划

> 配套方案：[solution.md](./solution.md)
>
> 本文件是供后续开发 AI / 开发者执行的详细计划。
>
> 目标：在保持 AI Manage 作为综合 AI 工具管理站的前提下，逐步把现有“模型配置”升级为独立、可靠的 Provider + Account + Runtime 能力。
>
> 本计划强调分阶段迁移，不要求一次性重写全部功能。

## 0. 执行规则

开发前必须遵守以下规则：

1. 先读根目录 `AGENTS.md`。
2. 先读 `docs/architecture-roadmap.md`。
3. 再读本目录 `solution.md` 与本文件。
4. 每个 Phase 单独完成、单独验证，避免跨 Phase 大范围同时修改。
5. 除明确迁移任务外，不修改 sessions、skills、mcp、trash、logs 等其它领域行为。
6. 所有新增公共方法使用 jsDoc 注释。
7. 跨 web/mobile 的契约进入 `packages/shared` / `packages/client`。
8. Element Plus 交互只留在 `apps/web`。
9. 所有 Secret 相关日志、错误回显必须检查泄露风险。
10. 每个 Phase 完成后至少运行：

~~~bash
pnpm check
pnpm test
pnpm build
~~~

11. 涉及 live 配置写入的阶段，必须额外补测试；不能只依赖手工验证。
12. 不要把 CC Switch 的 Proxy、Failover、协议转换等能力顺带实现进来。

---

# Phase 0：项目边界与现状确认

## 目标

在写新架构前，先确认当前实现、写权限、安全边界和迁移入口。

## 0.1 现有代码调查

重点阅读：

~~~text
apps/web/src/features/configs/use-configs.ts
apps/web/src/features/configs/components/ModelProviderManager.vue
apps/web/src/features/configs/components/ConfigEditorSections.vue

apps/api/src/routes/configs.controller.ts
apps/api/src/routes/configs.service.ts
apps/api/src/fs/path-guard.ts

apps/api/src/adapters/codex.adapter.ts
apps/api/src/adapters/claude.adapter.ts

packages/client/src/index.ts
packages/shared/src/contracts/
~~~

需要确认并记录：

- Codex config.toml 读写链
- Codex auth.json 读写链
- Claude settings.json 读写链
- 现有 backup / hash conflict 行为
- 现有 `replaceCodexOpenAiApiKey` 调用位置
- 现有 Provider 从 live 配置解析出来的路径
- 当前测试覆盖

## 0.2 更新开发规范

### 修改

`AGENTS.md`

把：

> 原始 AI 工具目录只读，不修改 ~/.codex 或 ~/.claude。

调整为与项目现状一致的受控写入规则，例如：

- 原始目录默认只读。
- 只有明确白名单配置文件允许写。
- 所有写操作必须经过 PathGuard。
- 高风险认证文件使用独立写入入口。
- 写前备份 / snapshot。
- 写后验证。
- 失败恢复。

不要把整个 `~/.codex` / `~/.claude` 开成可写。

## 0.3 明确首期范围

Phase 1-5 首期只要求：

### Codex

- 第三方 Provider
- OpenAI Official native login
- ChatGPT managed OAuth 多账号

### Claude

- 第三方 Provider
- Claude Official native login
- 不做 Claude 官方 OAuth 多账号托管

## Phase 0 验收

- 文档规范与真实产品边界一致。
- 没有业务行为变化。
- 后续 AI 明确知道哪些路径可以写、哪些不可以。

---

# Phase 1：建立 Managed State 与 Provider SSOT

## 目标

让 AI Manage 拥有自己的 Provider 数据源，不再把 live 配置直接当 Provider 数据库。

这一阶段先不改变主要用户体验，也不实现 OAuth。

---

## 1.1 新增 manage.sqlite

建议新增：

~~~text
apps/api/src/database/manage.migrations.ts
apps/api/src/database/manage.repository.ts
~~~

不要把 Provider 表塞进现有 `index.sqlite`。

### manage.sqlite 首版表

#### providers

建议字段：

~~~sql
id TEXT PRIMARY KEY,
tool TEXT NOT NULL,
name TEXT NOT NULL,
provider_type TEXT NOT NULL,
endpoint TEXT,
api_protocol TEXT,
default_model TEXT,
reasoning_effort TEXT,
auth_mode TEXT NOT NULL,
account_id TEXT,
credential_id TEXT,
metadata_json TEXT NOT NULL DEFAULT '{}',
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
~~~

索引：

~~~sql
CREATE INDEX idx_providers_tool ON providers(tool);
~~~

#### active_profiles

~~~sql
tool TEXT PRIMARY KEY,
provider_id TEXT NOT NULL,
switched_at TEXT NOT NULL
~~~

#### switch_history

~~~sql
id TEXT PRIMARY KEY,
tool TEXT NOT NULL,
from_provider_id TEXT,
to_provider_id TEXT,
status TEXT NOT NULL,
failed_stage TEXT,
error TEXT,
rolled_back INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL
~~~

暂时可以先预留 managed_accounts，或到 Phase 4 再迁移。

---

## 1.2 新增 shared contracts

新增：

~~~text
packages/shared/src/contracts/providers.ts
packages/shared/src/contracts/runtime.ts
packages/shared/src/contracts/credentials.ts
~~~

至少定义：

~~~ts
AiProviderProfile
ProviderAuthMode
ProviderPreset
ProviderCredentialSummary
RuntimeSummary
RuntimeSyncStatus
SwitchProviderRequest
SwitchProviderResponse
~~~

要求：

- 业务契约不包含 Element Plus 类型。
- Secret 不进入 Provider 列表 DTO。

更新 shared 根出口保持统一 import 风格。

---

## 1.3 新增 Providers 领域

新增：

~~~text
apps/api/src/providers/
├── providers.controller.ts
├── providers.service.ts
├── providers.repository.ts
├── provider-presets.ts
└── provider.mapper.ts
~~~

职责：

### ProvidersRepository

只处理 manage.sqlite。

### ProvidersService

处理：

- list
- get
- create
- update
- delete
- duplicate
- preset instantiate
- validation

### Provider mapper

ProviderProfile 与 Projection 输入模型之间的纯转换。

---

## 1.4 Provider Preset

首批 Preset：

### Codex

- openai-official
- openrouter
- deepseek
- custom-openai-compatible

### Claude

- claude-official
- openrouter
- deepseek
- custom-anthropic-compatible

Preset 至少包含：

~~~ts
id
tool
name
providerType
endpoint
apiProtocol
authMode
default metadata
~~~

Preset 是模板，不是业务状态。

---

## 1.5 Credential Store 初版

新增：

~~~text
apps/api/src/credentials/
├── credential-store.service.ts
└── credential-store.types.ts
~~~

首版支持 API Key。

建议格式：

~~~text
.data/credentials/api-keys.json
~~~

业务接口：

~~~ts
createApiKey()
replaceApiKey()
readApiKey()
deleteCredential()
hasCredential()
~~~

要求：

- 对外列表只能返回“已配置/未配置”。
- 不返回完整 key。
- atomic write。
- Unix 尽量使用 0600。
- 错误不得包含 key。

---

## 1.6 现有 Provider 导入器

新增：

~~~text
apps/api/src/providers/provider-import.service.ts
~~~

负责从当前 live 配置导入 Provider。

### Codex

解析：

- model_provider
- model
- model_reasoning_effort
- model_providers.*
- 认证模式

### Claude

解析：

- env.ANTHROPIC_BASE_URL
- env 模型字段
- API Key/Auth Token 状态

导入行为：

- 只读。
- 不修改 live。
- 已导入则避免重复。
- 无法匹配 preset 时创建 custom provider。

---

## 1.7 新增 client API

在 `packages/client` 增加：

~~~text
providers()
provider(id)
createProvider()
updateProvider()
deleteProvider()
duplicateProvider()
providerPresets()
importProviders()
~~~

不要让 web 自己拼 URL。

---

## 1.8 Phase 1 测试

新增后端测试：

- manage.sqlite migration
- Provider CRUD
- Provider preset
- credential store
- Provider importer
- Secret 不出现在列表 DTO

## Phase 1 验收

- manage.sqlite 成为 Provider SSOT。
- 可以从现有 live 配置导入。
- 现有模型配置页面暂时可以继续运行。
- 尚未切换到新 Provider UI 也没关系。
- 不影响其它领域。

---

# Phase 2：Switch Engine 与 Projection

## 目标

统一所有切换行为。

完成后，不允许 UI 再直接用 configs service 拼装“激活 Provider”的 live 修改。

---

## 2.1 新增 Projection 层

新增：

~~~text
apps/api/src/projections/
├── projection.types.ts
├── codex-projection.ts
└── claude-projection.ts
~~~

### 输入

~~~ts
{
  provider,
  credential,
  account?,
  currentLive
}
~~~

### 输出

~~~ts
{
  writes: [...],
  expectedRuntime,
  warnings
}
~~~

Projection 本身尽量纯函数化。

---

## 2.2 CodexProjection

负责：

- model_provider
- model
- model_reasoning_effort
- model_providers 对应条目
- 第三方 Provider credential 投影
- Official 模式

关键规则：

- 不整份覆盖 config.toml。
- 保留 projects。
- 保留 mcp_servers。
- 保留 features。
- 保留未知字段。
- 只删除/替换本 Provider 所拥有的字段。

需要根据当前 Codex 版本和现有项目兼容性决定第三方 API Key 最终 live 位置。

不要继续假设“所有第三方 key 都应该写 auth.json”。

---

## 2.3 ClaudeProjection

负责：

- ANTHROPIC_BASE_URL
- ANTHROPIC_API_KEY
- ANTHROPIC_AUTH_TOKEN
- 模型相关 env

保留：

- permissions
- plugins
- hooks
- projects
- 其它 env
- 未知字段

---

## 2.4 SnapshotService

新增：

~~~text
apps/api/src/runtime/snapshot.service.ts
~~~

定义 tool 级快照。

### Codex snapshot

至少：

- config.toml
- auth.json 是否存在
- auth.json 内容

### Claude snapshot

至少：

- settings.json
- 如果 Phase 2 会影响 settings.local.json，则一起捕获

恢复必须保持：

- 文件存在状态
- 原内容
- 原文件删除/创建语义

---

## 2.5 Atomic Writer

如果现有 ConfigsService 的写入不能满足跨文件事务要求，则抽：

~~~text
apps/api/src/runtime/live-file-writer.service.ts
~~~

要求：

1. temp file
2. validate
3. rename
4. 文件级失败可感知
5. 不在中途更新 active profile

---

## 2.6 SwitchService

新增：

~~~text
apps/api/src/runtime/switch.service.ts
~~~

标准阶段枚举：

~~~ts
'acquire_lock'
'load_provider'
'load_runtime'
'snapshot'
'resolve_auth'
'preflight_auth'
'project'
'validate'
'write_live'
'verify'
'commit_active'
'restore'
~~~

主流程必须完全匹配 solution.md 的事务顺序。

---

## 2.7 Tool 级锁

实现：

~~~text
codex lock
claude lock
~~~

同一 Tool 不允许同时切换。

不同 Tool 可以并行。

---

## 2.8 RuntimeDetectorService 初版

新增：

~~~text
apps/api/src/runtime/runtime-detector.service.ts
~~~

先实现：

~~~ts
GET /api/runtime?tool=codex
~~~

返回：

~~~ts
{
  tool,
  managedProviderId,
  actualProviderMatchId,
  syncStatus,
  model,
  providerName,
  accountSummary?,
  lastSwitchedAt?
}
~~~

Phase 2 可以只做 synced/unmanaged 两类基础状态。

---

## 2.9 RuntimeController

新增：

~~~text
apps/api/src/runtime/runtime.controller.ts
~~~

接口：

~~~http
GET  /api/runtime
POST /api/runtime/switch
~~~

更新 `AppModule`。

---

## 2.10 移除旧 activate 主路径

这一阶段完成后：

`use-configs.ts` 中的 `activateModelProvider()` 不应该再直接写 live Provider 配置。

短期可以让旧 UI 调：

~~~text
POST /api/runtime/switch
~~~

达到后端先统一、前端后迁移。

---

## 2.11 Phase 2 测试

必须覆盖：

### Codex

- 从 Provider A 切 B
- 保留无关 config.toml 字段
- 写 config 失败回滚
- 写 auth 失败回滚
- active profile 提交失败回滚
- 验证失败回滚

### Claude

- Provider 切换保留 permissions/plugins/hooks
- 失败回滚

### 并发

- 同 Tool 两次切换串行

## Phase 2 验收

- 所有 Provider 激活都走 SwitchService。
- live 写失败不产生半切换状态。
- active_profiles 与 live 成功结果一致。
- 旧 UI 仍可临时使用。

---

# Phase 3：新的“模型与账号”页面

## 目标

让普通用户不再进入“配置管理”完成模型切换。

---

## 3.1 Router 与 Sidebar

新增路由：

~~~text
/providers
~~~

建议 meta：

~~~ts
title: '模型与账号'
sidebarOpen: true
headerOpen: true
~~~

Sidebar 增加：

~~~text
模型与账号
~~~

位置建议在：

~~~text
对话
模型与账号
配置管理
~~~

---

## 3.2 前端 feature 结构

新增：

~~~text
apps/web/src/features/providers/
├── ProvidersPage.vue
├── use-providers.ts
├── provider-view-model.ts
├── components/
│   ├── CurrentRuntimeCard.vue
│   ├── ProviderGrid.vue
│   ├── ProviderCard.vue
│   ├── ProviderDrawer.vue
│   ├── ProviderPresetPicker.vue
│   ├── ModelPicker.vue
│   ├── AuthBindingEditor.vue
│   └── ProviderTestResult.vue
~~~

先不要把 Account Center 独立完成，Phase 4 再补。

---

## 3.3 页面布局

页面顶层：

~~~text
[当前运行环境]

[供应商]
  Provider cards...

[+ 添加供应商]
~~~

跟随全局 selectedTool。

切换 Codex/Claude 时自动重新拉：

- runtime
- providers
- presets

---

## 3.4 CurrentRuntimeCard

必须区分：

- AI Manage managed provider
- 实际 runtime
- 是否一致

展示：

- Provider
- 模型
- Reasoning
- auth 类型
- 状态
- 最后切换
- 快速切换按钮

---

## 3.5 ProviderCard

展示字段不宜过多。

统一摘要：

- 名称
- 模型
- endpoint
- auth summary
- connection status
- active state

操作：

- 切换
- 编辑
- 复制
- 测试
- 删除

避免在卡片直接暴露 Secret。

---

## 3.6 ProviderDrawer

创建/编辑采用“Preset 优先”。

### 新建

第 1 步：

~~~text
选择 Preset
~~~

第 2 步：

根据 preset 展示必要字段。

### 自定义

再开放：

- endpoint
- protocol
- model
- reasoning
- auth mode

Advanced 区域展示低频设置。

---

## 3.7 API Key 编辑体验

API Key 字段：

- 创建时可输入。
- 编辑时默认显示“已配置”，不要从服务端拉回完整 Secret。
- 用户主动选择“替换”才重新输入。
- 允许“移除凭据”。

这是新架构与当前 `fillCodexOpenAiApiKeyFromAuth()` 最大 UX 差异之一。

---

## 3.8 Provider Test

新增后端：

~~~http
POST /api/providers/:id/test
~~~

首版至少检测：

- endpoint 可达
- auth 是否通过
- 基础 API 格式

返回结构化错误。

前端不要直接展示第三方原始响应中的 Secret。

---

## 3.9 Model Fetch

新增：

~~~http
POST /api/providers/:id/models
~~~

或创建 Provider 前使用 draft request：

~~~http
POST /api/provider-tools/models
~~~

选择其中一种即可，但不要要求“必须先保存 Provider 才能获取模型”。

---

## 3.10 配置管理降级为高级入口

修改：

~~~text
features/configs/
~~~

目标：

- 不再展示完整 Provider CRUD。
- 模型 root 区域显示当前 runtime 摘要。
- 提供“前往模型与账号”。
- 保留高级 raw/root 配置查看能力。

不要一次删掉用户可见的原始配置编辑能力。

---

## 3.11 Phase 3 测试

前端至少覆盖：

- Provider list
- selectedTool 切换
- 创建 Provider
- 编辑 Provider
- API Key 已配置状态
- 切换 Provider
- 切换失败反馈
- 删除确认
- 当前 Provider 状态

## Phase 3 验收

普通用户可以完全不进配置管理完成：

- 添加 Provider
- 配 API Key
- 选模型
- 测试
- 切换

---

# Phase 4：Codex OAuth 多账号 Account Center

## 目标

实现 CC Switch 已验证的多 ChatGPT 账号能力，但保持与 Provider 分层。

---

## 4.1 manage.sqlite 新增 managed_accounts

字段建议：

~~~sql
id TEXT PRIMARY KEY,
auth_provider TEXT NOT NULL,
display_name TEXT,
email TEXT,
external_account_id TEXT,
identity_subject TEXT,
authenticated_at TEXT,
token_updated_at TEXT,
status TEXT NOT NULL,
is_default INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
~~~

不要用 external_account_id 做主键。

---

## 4.2 shared contracts

新增：

~~~text
packages/shared/src/contracts/accounts.ts
~~~

至少：

~~~ts
ManagedAccount
ManagedAccountSummary
StartDeviceLoginResponse
PollDeviceLoginResponse
ReauthAccountRequest
AccountStatus
~~~

---

## 4.3 CodexOAuthService

新增：

~~~text
apps/api/src/accounts/oauth/codex-oauth.service.ts
~~~

职责：

- start device flow
- poll authorization
- exchange code
- parse id_token
- create local account id
- store refresh token
- access token cache
- refresh access token
- reauth
- delete account

不把 HTTP OAuth 逻辑放进 controller。

---

## 4.4 OAuth Credential Store

扩展 credential store：

~~~text
.data/credentials/codex-oauth.json
~~~

建议结构：

~~~text
accountId -> refreshToken/idToken/token metadata
~~~

access token 优先内存缓存。

要求：

- refresh 按 accountId 加锁。
- 账号删除时同步清 credential。
- reauth 保持 accountId 不变。
- 同一身份重复登录必须明确处理，不允许静默覆盖另一个账号。

---

## 4.5 AuthBinding

Provider 增加：

~~~text
auth_mode = managed_account
account_id = <local account uuid>
~~~

OpenAI Official Provider 可选择：

- 跟随 Codex 原生登录
- 绑定托管 ChatGPT 账号

---

## 4.6 Account API

新增：

~~~http
GET    /api/accounts?provider=codex_oauth
POST   /api/accounts/codex-oauth/device
POST   /api/accounts/codex-oauth/device/:id/poll
POST   /api/accounts/:id/reauth
PATCH  /api/accounts/:id/default
DELETE /api/accounts/:id
~~~

---

## 4.7 Device Login UX

新增：

~~~text
apps/web/src/features/accounts/
├── AccountCenterDrawer.vue
├── AccountCard.vue
├── DeviceLoginDialog.vue
└── use-accounts.ts
~~~

DeviceLoginDialog 状态：

- requesting
- waiting
- success
- expired
- denied
- failed

允许：

- 复制代码
- 打开授权页
- 取消
- 重新获取

---

## 4.8 Provider 内直接绑定/添加账号

`AuthBindingEditor.vue`：

选择 managed_account 后显示：

~~~text
账号
[user@example.com ▼]

[添加账号]
~~~

点击添加账号直接打开 DeviceLoginDialog。

成功后：

- 刷新账号列表
- 自动选择新账号
- 不关闭 Provider Drawer

---

## 4.9 Managed Account 切换

SwitchService 增加完整 token bundle 处理。

流程：

1. resolve account
2. ensure account valid
3. refresh token if needed
4. snapshot live
5. build complete Codex auth live representation
6. write
7. verify identity
8. commit current

不要只替换 access token。

---

## 4.10 Native Login 与 Managed Login 共存

OpenAI Official Provider 必须允许两种卡片：

### Native

~~~text
auth_mode = native_login
~~~

表示跟随 Codex 自己当前登录。

### Managed

~~~text
auth_mode = managed_account
account_id = ...
~~~

表示 AI Manage 管理该账号并在切换时投影到 auth.json。

不能强迫所有官方 Provider 都由 AI Manage 接管。

---

## 4.11 Phase 4 测试

必须覆盖：

- 第一个账号登录
- 多账号
- 同 workspace 不同 identity
- 重复登录
- reauth 保留绑定
- 删除账号
- 默认账号
- token refresh
- refresh 失败
- Provider 绑定账号
- Provider 从账号 A 切 B
- 切换失败 rollback
- native login 不被错误覆盖

## Phase 4 验收

- 多个 ChatGPT 账号可以同时存在。
- 多张 OpenAI Official 卡可以绑定不同账号。
- 账号重新认证不破坏 Provider 绑定。
- bare Codex CLI 在切换后使用目标 managed 账号。
- native login 仍然是合法模式。

---

# Phase 5：Runtime 一致性、外部修改与迁移收尾

## 目标

解决“AI Manage 以为当前是 A，但用户外部已经改成 B”的问题。

---

## 5.1 RuntimeDetector 完整化

状态：

~~~ts
'synced'
'externally_modified'
'unmanaged'
'auth_invalid'
'reauth_required'
~~~

检测维度：

- Provider
- model
- endpoint
- account identity
- auth mode

---

## 5.2 外部变更提示

CurrentRuntimeCard 出现：

~~~text
检测到外部修改
~~~

提供：

### 采用当前状态

`POST /api/runtime/adopt-live`

行为：

- 解析当前 live
- 匹配已有 Provider 或创建 import draft
- 用户确认后更新 managed state

### 恢复 AI Manage 配置

`POST /api/runtime/restore-managed`

行为：

- 用 active profile 再走一次 SwitchService
- 必须 snapshot/rollback

---

## 5.3 启动/刷新同步

不要后台静默篡改。

进入模型与账号页面时：

- 拉 runtime
- 对比 managed
- 显示状态

App Shell 快捷切换弹层也可以拉轻量 runtime summary。

---

## 5.4 首次迁移 UX

如果 manage.sqlite 没有 Provider，但 live 有可识别配置：

~~~text
发现现有 Codex 配置

OpenAI Compatible
GPT-5.6
https://...

[导入]
[稍后]
~~~

导入过程不修改 live。

---

## 5.5 清理旧 Provider 逻辑

确认新页面稳定后，删除/收缩：

- `use-configs.ts` Provider CRUD
- `ModelProviderManager.vue`
- 旧 activate 逻辑
- `fillCodexOpenAiApiKeyFromAuth`
- 不再使用的 auth patch endpoint

如果某个旧 endpoint 仍被 mobile/client 使用，先迁移调用方再删除。

---

## 5.6 更新架构文档

更新：

~~~text
docs/architecture-roadmap.md
~~~

记录：

- manage.sqlite
- providers/accounts/runtime 领域
- 配置管理职责变化
- 写权限模型

## Phase 5 验收

- AI Manage 能识别外部修改。
- managed state 不再假装永远正确。
- 旧模型配置入口不再是 Provider SSOT。
- migration 不破坏现有配置。

---

# Phase 6：体验增强

## 目标

在核心模型稳定后再做高价值增强。

按优先级：

---

## 6.1 快速切换

App Shell 工具选择区域显示：

~~~text
Codex AI
OpenAI Official · user@example.com · GPT-5.6
~~~

点击展开：

- 当前环境
- 最近 Provider
- 快速切换
- 管理模型与账号

不要把完整 Provider 管理塞进 AppTopbar。

---

## 6.2 Overview Runtime Card

总览增加：

- 当前 Provider
- 模型
- 账号
- 状态
- 最后切换

只消费 RuntimeSummary。

---

## 6.3 Provider 排序

支持拖拽或 sortIndex。

---

## 6.4 Provider 复制

复制：

- 非 Secret 配置
- credential 默认不复制或显式询问

---

## 6.5 健康状态

支持：

- unknown
- healthy
- auth_error
- unreachable
- invalid_config

不要把一次临时网络错误永久标成 invalid。

---

## 6.6 账号额度

如果未来实现：

- 额度缓存必须 account scoped。
- 不允许多账号状态共用一个“当前 CLI 登录额度”。
- late response 不能覆盖已切换到新账号的 UI。

---

# 推荐提交粒度

不要一次提交“模型切换大重构”。

推荐：

1. `docs/chore: align controlled-write boundary`
2. `feat(db): add managed state database`
3. `feat(providers): add provider domain and presets`
4. `feat(credentials): add credential store`
5. `feat(runtime): add provider projections`
6. `feat(runtime): add transactional switch service`
7. `feat(web): add model and account management page`
8. `refactor(configs): move provider management out of configs`
9. `feat(accounts): add codex oauth account center`
10. `feat(runtime): detect external configuration changes`
11. `refactor(configs): remove legacy provider activation path`
12. `docs: update architecture roadmap`

每个提交尽量保持可以独立 review。

---

# 文件级迁移清单

## 预计新增

~~~text
docs/model-switching/
├── solution.md
└── plan.md

apps/api/src/database/manage.migrations.ts
apps/api/src/database/manage.repository.ts

apps/api/src/providers/*
apps/api/src/accounts/*
apps/api/src/credentials/*
apps/api/src/runtime/*
apps/api/src/projections/*

apps/web/src/features/providers/*
apps/web/src/features/accounts/*

packages/shared/src/contracts/providers.ts
packages/shared/src/contracts/accounts.ts
packages/shared/src/contracts/runtime.ts
packages/shared/src/contracts/credentials.ts
~~~

## 预计修改

~~~text
AGENTS.md

apps/api/src/app.module.ts
apps/api/src/fs/path-guard.ts

apps/web/src/router.ts
apps/web/src/layouts/components/AppSidebar.vue
apps/web/src/layouts/AppLayout.vue
apps/web/src/features/overview/*
apps/web/src/features/configs/*

packages/client/src/index.ts
packages/shared/src/index.ts

docs/architecture-roadmap.md
~~~

## 后期可能删除

~~~text
apps/web/src/features/configs/components/ModelProviderManager.vue
~~~

是否删除取决于新页面是否完全替代；不要提前删除。

---

# API 最终目标

## Providers

~~~http
GET    /api/providers?tool=codex
GET    /api/providers/presets?tool=codex
POST   /api/providers
GET    /api/providers/:id
PATCH  /api/providers/:id
DELETE /api/providers/:id
POST   /api/providers/:id/duplicate
POST   /api/providers/:id/test
POST   /api/providers/:id/models
POST   /api/providers/import-live
~~~

## Accounts

~~~http
GET    /api/accounts?provider=codex_oauth
POST   /api/accounts/codex-oauth/device
POST   /api/accounts/codex-oauth/device/:id/poll
POST   /api/accounts/:id/reauth
PATCH  /api/accounts/:id/default
DELETE /api/accounts/:id
~~~

## Runtime

~~~http
GET  /api/runtime?tool=codex
POST /api/runtime/switch
POST /api/runtime/adopt-live
POST /api/runtime/restore-managed
GET  /api/runtime/switch-history?tool=codex
~~~

---

# 测试策略

## 单元测试

重点：

- Provider validation
- Preset
- Projection merge
- Credential redaction
- OAuth token parsing
- Runtime matching

## Repository 测试

- migration
- Provider CRUD
- active profile
- switch history
- managed account

## Switch 集成测试

必须使用临时 HOME / 临时 live 文件。

严禁测试直接写真实用户的：

~~~text
~/.codex
~/.claude
~~~

覆盖：

- 正常切换
- 多文件写
- 失败回滚
- managed state commit 失败
- 外部状态冲突
- auth 文件不存在/存在

## 前端测试

覆盖：

- Provider list
- Provider form
- Preset
- API Key replace UX
- Account Center
- Device Code states
- CurrentRuntimeCard
- external modification warning
- switch feedback

---

# UX 验收清单

开发完成后人工验证：

## Provider

- [ ] 普通用户不需要理解 TOML/JSON 即可添加 Provider
- [ ] Preset 能自动带出必要配置
- [ ] API Key 不会在重新编辑时被意外从共享 auth 文件覆盖
- [ ] 能测试 Provider
- [ ] 能获取模型
- [ ] 能复制 Provider
- [ ] 能安全删除 Provider

## Account

- [ ] 可以添加多个 ChatGPT 账号
- [ ] 账号展示 email
- [ ] 同 Workspace 不同成员不会互相覆盖
- [ ] 可以 reauth
- [ ] reauth 不破坏绑定
- [ ] Provider 创建时可以直接添加账号
- [ ] Provider 可以重新绑定账号

## Switch

- [ ] 切换过程有明确 loading
- [ ] 成功后 CurrentRuntimeCard 立即更新
- [ ] 失败能告诉用户失败阶段
- [ ] 失败后明确说明是否回滚成功
- [ ] 不会出现 DB=A、live=B 的静默半切换

## External Change

- [ ] 用户手动 `codex login` 后可检测
- [ ] 用户手改 config 后可检测
- [ ] 可以采用外部状态
- [ ] 可以恢复 managed 状态

## 综合产品

- [ ] “模型与账号”只是一级模块之一
- [ ] Overview 不被 Provider 逻辑绑死
- [ ] configs 仍可承担高级配置
- [ ] MCP/Skills/会话功能没有行为回归
- [ ] shared/client 可供 future mobile 复用

---

# 明确禁止的实现方式

后续 AI 开发时不要采用以下捷径：

1. 不要继续把 OAuth 字段直接塞进 `ModelProviderForm`。
2. 不要把 Provider 永久存回 `config.toml` 当数据库。
3. 不要把 managed account token 直接存在普通 Provider 表。
4. 不要让 Provider 列表接口返回完整 Secret。
5. 不要继续从当前共享 `auth.json` 读取某个 Provider 自己的 API Key。
6. 不要让两个并发 switch 同时写一个 Tool。
7. 不要先更新 active profile 再尝试写 live。
8. 不要整份覆盖 Claude settings.json。
9. 不要整份覆盖 Codex config.toml 丢掉用户未知配置。
10. 不要为了这次功能顺便实现 Proxy/Failover。
11. 不要让 configs 与 providers 两套 UI 同时成为 Provider SSOT。
12. 不要用 `chatgpt_account_id` 直接作为 managed account 主键。
13. 不要让 OAuth reauth 创建一个全新本地账号从而丢失 Provider binding。
14. 不要自动“修复”外部修改而不告知用户。

---

# 建议开发顺序总结

~~~text
Phase 0
规范/边界
   ↓
Phase 1
manage.sqlite + Provider SSOT + Credential
   ↓
Phase 2
Projection + Switch Transaction
   ↓
Phase 3
新的模型与账号页面
   ↓
Phase 4
ChatGPT OAuth 多账号
   ↓
Phase 5
Runtime 一致性 + 外部修改 + 清理旧路径
   ↓
Phase 6
快捷切换/额度/健康等增强
~~~

如果开发资源有限，优先做到 Phase 1-4。

Phase 1-4 完成后，就已经具备相比现有实现质变的用户体验：

- Provider 独立管理
- API Key 独立凭据
- 一键可靠切换
- ChatGPT 多账号
- Provider 绑定账号
- 失败回滚

Phase 5 再解决长期可靠性，Phase 6 做体验增强。

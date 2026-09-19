# 模型与账号切换升级方案

> 状态：设计方案
>
> 目标：在不把 AI Manage 变成“模型切换工具”的前提下，把模型/供应商/账号切换升级为一个成熟、独立、可扩展的领域能力。
>
> 本文只描述方案，不包含业务代码实现。详细落地步骤见 [plan.md](./plan.md)。

## 1. 背景

AI Manage 的最终定位不是单一的模型切换器，而是本地 AI 工具的综合管理站。现有能力已经覆盖：

- 总览与工具状态
- 对话工作区
- 配置管理
- MCP 服务器
- Skills
- 文件浏览
- 历史会话
- 回收站
- 运行日志

因此，“模型切换”应当是平台中的一个独立功能域，而不是反过来成为整个项目的数据中心或架构中心。

现有模型配置功能主要围绕 Codex/Claude 的 live 配置文件直接读写：

- Codex：`~/.codex/config.toml`、`~/.codex/auth.json`
- Claude：`~/.claude/settings.json`

当前前端已经有 Provider 卡片、新建/编辑/激活能力，但 Provider、API Key、账号身份、live 配置之间仍然高度耦合，尤其 Codex 的第三方 API Key 与官方 OAuth 登录尚未形成清晰边界。

## 2. 参考实现与吸收原则

CC Switch 已经在大量真实用户环境中验证了 Provider 卡片、一键切换、Preset、OAuth Auth Center、Provider 与账号绑定、切换事务、live 配置投影等交互。

参考：

- Provider 添加与预设：
  https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/2-providers/2.1-add.md
- Provider 切换：
  https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/2-providers/2.2-switch.md
- Codex 多 ChatGPT 账号与 Provider 绑定：
  https://github.com/farion1231/cc-switch/blob/main/docs/release-notes/v3.20.0-en.md
- 同 Workspace 多账号身份隔离：
  https://github.com/farion1231/cc-switch/blob/main/docs/release-notes/v3.20.1-en.md

本项目不照搬 CC Switch 全部能力，只吸收已经被验证的核心设计：

1. Provider 与 Account 分离。
2. 用户管理数据与 AI 工具 live 配置分离。
3. 切换行为走统一 Switch Engine。
4. Provider 通过 AuthBinding 选择认证来源。
5. OAuth Account 独立管理生命周期。
6. 切换只修改自己负责的字段，保留用户其它配置。
7. 切换必须可验证、可回滚、可诊断。
8. Preset 优先，降低用户填写底层配置字段的成本。

暂不引入：

- 本地代理接管
- Failover
- 请求协议实时转换
- 自动路由
- 请求级计费
- 云同步
- 系统托盘

这些能力将来可以独立设计，不应成为本次模型切换重构的前置条件。

## 3. 产品定位

模型切换模块建议命名为：

**模型与账号**

它作为 AI Manage 的一个一级功能，与配置、MCP、Skills、会话等能力并列。

建议侧栏信息架构：

~~~text
总览
对话

模型与账号
配置管理
MCP 服务器
技能管理

历史会话
文件浏览
运行日志
回收站
~~~

### 3.1 模型与账号负责什么

- 当前运行环境
- Provider 管理
- Preset 添加
- 模型选择
- API Key 凭据绑定
- ChatGPT OAuth 账号管理
- Provider 与账号绑定
- 连接测试
- 一键切换
- live 状态检测
- 外部变更提示
- 切换历史

### 3.2 配置管理继续负责什么

配置管理保留高级配置能力：

- AGENTS.md / CLAUDE.md
- permissions
- projects
- features
- plugins
- hooks
- MCP 原始配置
- 其它 TOML / JSON 高级字段

模型、Provider、账号等标准能力不再由配置管理维护两套编辑入口。

配置管理中如果出现模型相关字段，应以“当前运行环境摘要 + 前往模型与账号”为主要入口，高级用户仍可查看相关 live 字段，但避免出现两套业务状态源。

## 4. 核心架构原则

### 4.1 AI Manage 保存用户意图，live 配置只是投影结果

目标架构：

~~~text
AI Manage Managed State
        |
        +-- ProviderProfile
        +-- ManagedAccount
        +-- Credential
        +-- ActiveProfile
        |
        v
     SwitchService
        |
        +-- CodexProjection
        +-- ClaudeProjection
        |
        v
AI Tool Live Configuration
~~~

以后不再把 `config.toml` / `settings.json` 当作 Provider 数据库。

live 配置仍然是最终执行入口，但它是“当前生效状态”，不是 AI Manage 管理数据的唯一存储。

### 4.2 模块边界必须独立

模型切换域不能直接依赖：

- sessions
- trash
- logs
- skills
- mcp
- workspace

其它领域也不能依赖 Provider 内部实现。

跨领域只通过清晰的公共契约，例如：

- 当前工具运行环境摘要
- runtime changed 事件
- provider display metadata

这样未来继续扩展 AI Manage 时不会形成“所有功能都围着 Provider 转”的架构。

## 5. 领域模型

### 5.1 ProviderProfile

Provider 表示“如何使用某个模型线路”，不表示账号本身。

建议字段：

~~~ts
interface ProviderProfile {
  id: string;
  tool: 'codex' | 'claude';

  name: string;
  providerType: string;
  icon?: string;

  endpoint?: string;
  apiProtocol?: string;

  defaultModel?: string;
  reasoningEffort?: string;

  authMode: 'native_login' | 'managed_account' | 'api_key' | 'none';
  accountId?: string;
  credentialId?: string;

  metadata: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}
~~~

Provider 不直接保存 OAuth Token。

### 5.2 ManagedAccount

账号用于描述 OAuth 身份。

~~~ts
interface ManagedAccount {
  id: string;
  authProvider: string;

  displayName?: string;
  email?: string;

  externalAccountId?: string;
  identitySubject?: string;

  authenticatedAt?: string;
  tokenUpdatedAt?: string;

  status: 'active' | 'reauth_required' | 'invalid';
}
~~~

必须使用本地稳定 UUID 做账号主键。

不要用 `chatgpt_account_id` 作为主键，因为它可能表示 workspace，而不是唯一用户身份。同一个 Team Workspace 的不同成员必须能共存。

### 5.3 AuthBinding

逻辑上 Provider 通过 AuthBinding 选择认证来源：

~~~ts
interface AuthBinding {
  mode: 'native_login' | 'managed_account' | 'api_key' | 'none';
  accountId?: string;
  credentialId?: string;
}
~~~

实际数据库可以直接存于 Provider 表，也可以后续拆成独立表。

### 5.4 Credential

Credential 是 Secret 层，不等于 Provider。

初期至少支持：

- API Key
- OAuth refresh token
- OAuth id token

普通业务表只保存 credentialId，不直接保存明文 Secret。

### 5.5 ActiveProfile

每个 Tool 只有一个 AI Manage 记录的当前 Provider：

~~~text
tool
provider_id
switched_at
~~~

注意：ActiveProfile 是“AI Manage 记录的 managed 状态”，实际磁盘状态还要通过 RuntimeDetector 校验。

### 5.6 SwitchHistory

建议持久化：

~~~text
id
tool
from_provider_id
to_provider_id
status
failed_stage
error
rolled_back
created_at
~~~

主要用于：

- 用户排查切换失败
- UI 展示最近切换
- 开发调试
- 后续健康统计

## 6. 数据存储

建议新增：

~~~text
.data/
├── index.sqlite
└── manage.sqlite
~~~

### index.sqlite

只存可重建数据：

- sessions
- scan_status
- 搜索索引相关数据

### manage.sqlite

存用户管理数据：

- providers
- managed_accounts
- active_profiles
- switch_history
- settings

模型与账号不能直接塞进 `index.sqlite`，因为它们属于用户权威数据，而索引数据库理论上可以删除后重建。

### Secret Store

首版可以使用独立 credential store：

~~~text
.data/credentials/
├── api-keys.json
└── codex-oauth.json
~~~

要求：

- 文件权限收紧
- atomic write
- 不写日志
- 不返回到不需要 Secret 的列表接口
- 错误信息必须避免回显 Secret

后续可以升级为：

- macOS Keychain
- Windows Credential Manager
- Linux Secret Service

## 7. 后端模块结构

建议逐步形成：

~~~text
apps/api/src/
├── providers/
│   ├── providers.controller.ts
│   ├── providers.service.ts
│   └── providers.repository.ts
│
├── accounts/
│   ├── accounts.controller.ts
│   ├── accounts.service.ts
│   └── oauth/
│       └── codex-oauth.service.ts
│
├── credentials/
│   └── credential-store.service.ts
│
├── runtime/
│   ├── runtime.controller.ts
│   ├── runtime-detector.service.ts
│   ├── switch.service.ts
│   └── snapshot.service.ts
│
├── projections/
│   ├── codex-projection.ts
│   └── claude-projection.ts
~~~

职责必须明确。

### ProvidersService

负责：

- Provider CRUD
- Preset 实例化
- Provider 校验
- Provider 与 Account/Credential 绑定

不负责直接写 `~/.codex` / `~/.claude`。

### AccountsService

负责：

- OAuth 账号管理
- 登录状态
- 默认账号
- 重新认证
- 删除账号

### CredentialStoreService

负责 Secret 读写。

### SwitchService

负责完整切换事务，是唯一标准切换入口。

### RuntimeDetectorService

负责判断实际 live 状态，与 managed 状态对比。

### Projection

只负责：

~~~text
Provider + Account/Credential + Existing Live Config
                    ↓
             Target Live Config
~~~

Codex/Claude 的文件差异留在 Projection 层。

## 8. Switch Engine

所有模型/Provider/账号切换必须走同一个流程：

~~~text
POST /api/runtime/switch
        |
        v
1. 获取 tool 级切换锁
        |
        v
2. 读取当前 live 状态
        |
        v
3. 创建 snapshot
        |
        v
4. 加载目标 Provider
        |
        v
5. Resolve AuthBinding
        |
        +-- native_login
        +-- managed_account
        +-- api_key
        |
        v
6. 凭据预检
        |
        v
7. Projection 构建目标配置
        |
        v
8. 目标配置校验
        |
        v
9. Atomic Write
        |
        v
10. Runtime Verify
        |
        v
11. 更新 active_profiles
        |
        v
12. 写 switch_history
~~~

任何关键步骤失败：

~~~text
restore(snapshot)
~~~

返回结果至少包含：

~~~ts
interface SwitchResult {
  success: boolean;
  tool: AiTool;
  providerId: string;

  stage?: string;
  rolledBack?: boolean;
  warnings?: string[];

  runtime?: RuntimeSummary;
}
~~~

前端应该能明确显示：

- 切换失败在哪一步
- 是否已成功回滚
- 是否存在非致命 warning

## 9. 只修改 Provider 自己负责的字段

切换不能整份覆盖用户 live 配置。

### Claude

Provider 主要负责：

- ANTHROPIC_BASE_URL
- ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN
- 模型相关字段

应保留：

- permissions
- plugins
- hooks
- projects
- 其它未知字段

### Codex

Provider 主要负责：

- model_provider
- model
- model_reasoning_effort
- 对应 model_providers 条目
- 对应认证信息

应尽量保留：

- projects
- features
- mcp_servers
- 用户未知扩展字段

Projection 必须采用明确的 owned-fields 策略，而不是“Provider 配置覆盖整个 live 文件”。

## 10. Codex 认证边界

这是本次重构最重要的技术边界之一。

### 第三方 Provider

第三方 API Key 属于 Provider Credential。

不要再通过编辑 Provider 时从当前共享 `auth.json` 读取 Key。

Provider 自己应该绑定独立 credentialId。

### OpenAI Official

官方 ChatGPT 登录属于 ManagedAccount / native_login。

`auth.json` 是 Codex live 认证状态的一部分。

Managed ChatGPT Account 切换时，应写入目标账号完整、可继续刷新的 token bundle，而不是只替换某一个 access token 字段。

### 当前实现的迁移方向

现有：

- `replaceCodexOpenAiApiKey()`
- `fillCodexOpenAiApiKeyFromAuth()`

在新架构完成后应退出标准 Provider 管理路径。

不能让“第三方 API Key”和“官方 ChatGPT OAuth”继续竞争同一个共享认证状态来源。

## 11. ChatGPT OAuth Account Center

第一阶段只实现 Codex OAuth。

支持：

- 添加账号
- Device Code 登录
- 登录状态
- 多账号列表
- 设置默认账号
- Provider 绑定账号
- 重新认证
- 删除账号

Device Code UX：

~~~text
连接 ChatGPT

正在申请登录代码...

ABCD-EFGH

[复制代码] [打开授权页面]

等待授权...
~~~

成功：

~~~text
登录成功

user@example.com

[完成]
~~~

Provider 编辑时必须支持原地添加账号，不要求用户退出当前编辑流程再进入独立账号中心。

## 12. 前端信息架构

建议新增：

~~~text
apps/web/src/features/providers/
├── ProvidersPage.vue
├── use-providers.ts
├── components/
│   ├── CurrentRuntimeCard.vue
│   ├── ProviderCard.vue
│   ├── ProviderGrid.vue
│   ├── ProviderDrawer.vue
│   ├── ProviderPresetPicker.vue
│   ├── ModelPicker.vue
│   └── AuthBindingEditor.vue

apps/web/src/features/accounts/
├── AccountCenterDrawer.vue
├── AccountCard.vue
├── DeviceLoginDialog.vue
└── use-accounts.ts
~~~

现有 `features/configs/use-configs.ts` 中的 Provider 业务逐步移出。

最终 configs 只负责高级配置。

## 13. 模型与账号页面 UX

### 13.1 当前运行环境

~~~text
Codex

OpenAI Official
GPT-5.6 · High

user@example.com
ChatGPT Plus

● 正常

最后切换 13:32

[快速切换] [编辑]
~~~

### 13.2 Provider 卡片

官方账号：

~~~text
OpenAI Official            当前使用

GPT-5.6
High

user@example.com
ChatGPT Plus

● 可用

[切换] [···]
~~~

第三方：

~~~text
OpenRouter

GPT-5.6
https://openrouter.ai/api/v1

API Key 已配置
● 连接正常

[切换] [···]
~~~

更多操作：

- 编辑
- 复制
- 测试连接
- 设置为默认
- 删除

### 13.3 Account 区域

展示：

- ChatGPT 账号
- 默认账号
- 是否需要重新登录
- 最近认证
- 删除/重新认证
- 后续可增加额度展示

## 14. Preset 优先

新增 Provider 不应要求普通用户理解：

- wire_api
- model_provider
- config.toml 结构
- env 字段名

添加流程：

~~~text
+ 添加供应商
      ↓
选择 Preset
      ↓
自动填 endpoint / protocol / authMode
      ↓
用户只填关键内容
      ↓
测试连接 / 获取模型
      ↓
保存
~~~

第一批 Preset 可以覆盖：

Codex：

- OpenAI Official
- OpenRouter
- DeepSeek
- 自定义 OpenAI Compatible

Claude：

- Claude Official
- DeepSeek
- OpenRouter
- 自定义 Anthropic Compatible

不需要一开始追求 CC Switch 的 Provider 数量。

## 15. 自动获取模型

Provider 编辑支持“获取模型”。

流程：

- endpoint + credential
- 调用兼容的 models endpoint
- 后端过滤/规范化响应
- 返回结构化模型列表
- 前端 Select 选择

失败时：

- 401/403：认证失败
- 404/405：不支持自动发现
- timeout：连接超时
- parse：响应格式不支持

Secret 不得出现在错误信息。

## 16. Runtime 一致性与外部修改

AI Manage 不能只相信 `active_profiles`。

必须同时检测：

~~~text
Managed State
vs
Actual Live State
~~~

状态至少包括：

- synced：managed 与 live 一致
- externally_modified：检测到外部修改
- auth_invalid：认证无效
- reauth_required：账号需要重新认证
- unmanaged：当前 live 状态不是 AI Manage 中已知 Provider

例如用户外部执行 `codex login` 后：

~~~text
检测到 Codex 当前登录已被外部修改

AI Manage：
work@example.com

当前实际：
personal@example.com

[采用当前状态]
[恢复 AI Manage 配置]
~~~

## 17. 导入当前配置

升级不能强迫现有用户重新创建所有 Provider。

首次进入模型与账号页面时：

1. 读取 Codex/Claude live 配置。
2. 尝试识别 endpoint、模型、认证模式。
3. 如果可以映射到 Preset，生成对应 Provider。
4. 无法识别时生成“导入的自定义配置”。
5. 用户确认后写入 manage.sqlite。
6. 不在导入过程中修改 live 配置。

## 18. 快速切换

AI Manage 是综合管理台，因此建议在 App Shell 提供轻量快速入口，而不是依赖用户总进入 Provider 页面。

~~~text
Codex AI

OpenAI Official
user@example.com · GPT-5.6
~~~

点击后：

~~~text
当前环境

OpenAI Official
user@example.com
GPT-5.6 High

快速切换
○ OpenAI · 私人
○ OpenAI · 工作
○ OpenRouter
○ DeepSeek

管理模型与账号
~~~

完整管理仍在模型与账号页面。

## 19. Overview 集成

总览页只消费 RuntimeSummary，不直接理解 Provider 内部结构。

新增“当前运行环境”卡片：

- Provider
- 模型
- 账号
- 健康状态
- 最后切换
- 快速进入模型与账号

这样模型切换与其它总览能力并存，不把 Overview 变成 Provider 专页。

## 20. API 草案

### Provider

~~~http
GET    /api/providers?tool=codex
POST   /api/providers
GET    /api/providers/:id
PATCH  /api/providers/:id
DELETE /api/providers/:id

POST   /api/providers/:id/test
POST   /api/providers/:id/models
~~~

### Account

~~~http
GET    /api/accounts?provider=codex_oauth

POST   /api/accounts/codex-oauth/device
POST   /api/accounts/codex-oauth/device/:id/poll

POST   /api/accounts/:id/reauth
PATCH  /api/accounts/:id/default
DELETE /api/accounts/:id
~~~

### Runtime

~~~http
GET  /api/runtime?tool=codex
POST /api/runtime/switch
POST /api/runtime/adopt-live
POST /api/runtime/restore-managed
~~~

## 21. packages/shared 与 packages/client

建议：

~~~text
packages/shared/src/contracts/
├── providers.ts
├── accounts.ts
├── runtime.ts
└── credentials.ts
~~~

`packages/client` 对应新增：

- providers API
- accounts API
- runtime API

PC 与未来 mobile 共用。

前端专属状态、Element Plus 类型不能进入 shared/client。

## 22. 安全设计

### 22.1 写权限边界

当前根 `AGENTS.md` 仍写着“原始 AI 工具目录只读”，但项目现状已经存在配置编辑能力，而模型切换会正式需要受控写 live 配置。

因此实施前必须同步项目规范：

- 从“绝对只读”改成“默认只读、明确白名单的受控写入”。
- 配置写必须白名单。
- auth 写必须专用 PathGuard。
- 每次切换必须 snapshot。
- 写后必须验证。
- 失败必须恢复。

本方案不直接修改 `AGENTS.md`，但实施阶段必须处理。

### 22.2 Secret

禁止：

- Secret 进入日志
- Secret 出现在错误回显
- Provider 列表接口返回完整 Secret
- Secret 写进普通 metadata_json

### 22.3 OAuth

必须：

- refresh token 持久化
- access token 可缓存但不必长期存
- 账号级刷新锁
- 删除账号时清理对应凭据
- reauth 不改变本地 account id
- Provider 绑定不因 reauth 丢失

## 23. 并发与事务

每个 Tool 的切换必须串行：

~~~text
codex-switch-lock
claude-switch-lock
~~~

OAuth refresh 建议按 accountId 独立锁。

切换事务原则：

> live 写入成功且验证成功后，再提交 managed current；如果提交失败，必须恢复 live。

## 24. 与现有代码的兼容与迁移

现有可复用：

- Config reader/parser
- PathGuard 基础设施
- TOML / JSON 保存能力
- ModelProviderManager 的视觉基础
- packages/client
- Element Plus Design System
- selectedTool 全局状态
- API Feedback

需要逐步退出 Provider 主流程：

- `ModelProviderManager` 作为 configs 内业务入口
- `use-configs.ts` 中大量 Provider 业务
- `replaceCodexOpenAiApiKey()`
- `fillCodexOpenAiApiKeyFromAuth()`
- 直接以 live 配置里的 model_providers 作为 Provider 数据库

迁移过程中不能一次删除旧逻辑；应先建立新 SSOT，再做导入、双读验证，最后删除旧入口。

## 25. 非目标

本次升级不要求：

- 支持所有 CC Switch Provider
- 完整复制其 UI
- 实现代理接管
- 实现自动 Failover
- 实现跨协议流量转换
- 接管 Codex/Claude 的所有认证方式
- 一次性支持 Claude 官方多账号 OAuth

首个账号中心只聚焦 Codex / ChatGPT OAuth。

## 26. 完成标准

当本方案完整实施后，应满足：

1. Provider 不再以 live 配置文件为唯一存储。
2. 第三方 API Key 与官方 ChatGPT OAuth 明确分离。
3. 可管理多个 ChatGPT 账号。
4. Provider 可绑定指定账号。
5. 切换操作统一走 SwitchService。
6. 切换具备 snapshot、verify、rollback。
7. 外部修改能够被检测。
8. 配置管理不再承担标准 Provider CRUD。
9. 模型切换作为独立领域，不影响会话、MCP、Skills 等其它功能架构。
10. PC 与未来 mobile 可以通过 shared/client 共用业务契约。

## 27. 推荐实施阶段

整体建议拆为：

- Phase 0：确认边界与规范同步
- Phase 1：Managed State 与 Provider SSOT
- Phase 2：Switch Engine 与 Projection
- Phase 3：模型与账号页面
- Phase 4：Codex OAuth 多账号
- Phase 5：Runtime 一致性与迁移
- Phase 6：体验增强

具体开发任务、文件级计划、验收条件见 [plan.md](./plan.md)。

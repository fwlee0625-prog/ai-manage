# Phase 0：项目边界与现状确认记录

> 状态：完成
>
> 对应计划：`docs/model-switching/plan.md` Phase 0

## 现状调查结果

### 1. 当前配置写入边界

当前项目已经存在受控写入机制：

- Codex：`~/.codex/config.toml`、`~/.codex/auth.json`
- Claude：`~/.claude/settings.json`、`~/.claude/settings.local.json`
- Claude 全局配置：`~/.claude.json`

写入入口需要经过 PathGuard 控制，不允许任意路径修改。

## 2. 当前模型 Provider 实现

现有模型 Provider 仍属于 Configs 领域：

- 前端通过配置页面管理 Provider 卡片。
- Provider 数据直接来源于 live 配置。
- Codex API Key 修改直接操作 `auth.json`。

现状问题：

- Provider 身份和 live 配置强耦合。
- Secret 和 Provider 生命周期没有分离。
- 后续无法自然支持多账号、OAuth、切换历史。

## 3. Codex 当前边界

当前主要涉及：

- `config.toml`
  - model_provider
  - model_providers
  - model
  - model_reasoning_effort

- `auth.json`
  - OPENAI_API_KEY

后续迁移需要避免整文件覆盖，只修改 Provider 所拥有字段。

## 4. Claude 当前边界

当前主要涉及：

- `settings.json`
- `settings.local.json`
- `.claude.json`

模型相关信息主要来自配置字段和 env。

后续 Projection 层需要保留：

- permissions
- plugins
- hooks
- projects
- 未知字段

## 5. 当前备份与冲突保护

已有能力：

- 配置保存前 backup。
- hash 校验避免覆盖磁盘外部修改。
- 临时文件写入后 rename。

后续 Switch Engine 需要在此基础上扩展跨文件 snapshot 和回滚。

## 6. Phase 1 迁移原则

进入 Phase 1 后：

- 新增 manage.sqlite 保存 Provider 管理状态。
- live 配置变为运行投影结果。
- 不立即删除旧 Configs 页面能力。
- 不影响 sessions、skills、mcp、trash、logs。

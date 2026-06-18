# AI Manage PC 端系统风格设计文档

## 1. 结论

当前项目不建议只通过 Element Plus 全局配置完成风格改造，也不建议一次性抛开 Element Plus 全量自研组件。

推荐方案是“主题令牌 + Element Plus 主题桥接 + 自研业务壳组件逐步替换”：

- Element Plus 继续承担表格、表单、弹窗、选择器、加载、提示等成熟桌面交互。
- 全局样式只负责设计令牌、基础排版、Element Plus 变量映射和低风险一致性修正。
- 自研组件负责系统骨架、数据卡片、指标卡、页面工具栏、分栏面板、状态块、文件/会话业务列表等产品识别度强的区域。
- 迁移以 PC 管理台为边界，不处理移动端，不把移动端样式塞进 `apps/web`。

这能保留 Element Plus 的工程效率，同时让界面从“默认组件库拼装感”升级为“AI 工具本机管理台”的稳定系统风格。

## 2. 参考图提炼

### 2.1 参考图一：青柠渐变与高对比标题

可吸收的部分：

- 青柠绿、冰感蓝、海盐绿组成的渐变色，适合作为品牌强调、扫描状态、索引刷新、可用状态。
- 大字号、强对比、黑白留白，适合用在关键状态和页面识别区域。
- 圆角矩形和黑色描边带来强烈记忆点，但不适合照搬到管理后台所有控件。

需要克制的部分：

- 不把整个系统做成纯霓虹或纯绿色，否则长期操作会疲劳。
- 不在表格、输入框、复杂列表里使用大面积高饱和渐变。
- 不使用过大的圆角和厚描边破坏 PC 管理台的信息密度。

### 2.2 参考图二：制造运营平台大屏

可吸收的部分：

- 左侧导航 + 顶部状态 + 多卡片仪表盘的结构适合当前 PC 管理台。
- 柔和背景、轻玻璃面板、蓝紫辅助光感，适合做总览页和数据页。
- 指标卡、趋势图、状态列表、流程条等模块化组织方式适合中型开源项目继续扩展。

需要克制的部分：

- 当前项目是本机工具管理站，不是展示大屏，不能牺牲可读性和操作效率。
- 光效只能作为背景层，不要影响日志、配置、会话内容的阅读。
- 卡片之间要保持信息层级，不做一屏全是装饰卡片。

## 3. 产品气质

关键词：

- Local-first：本机、安全、可信。
- AI console：技术感、精确、可诊断。
- Calm dashboard：轻量、低干扰、长时间可用。
- Config cockpit：配置、会话、技能和日志可以快速切换、扫描、定位。

目标视觉不是“炫酷大屏”，而是“有辨识度的桌面管理台”。

## 4. 风格方向

### 4.1 色彩策略

使用“浅色工作台 + 冷色科技底 + 青柠状态强调”。

基础色：

- 页面背景：`#F5F8FF`
- 主面板：`#FFFFFF`
- 次级面板：`#F8FBFF`
- 主文本：`#142033`
- 次文本：`#65738A`
- 分割线：`#DDE6F3`

品牌与状态色：

- 品牌青柠：`#AACC00`
- 冰感蓝绿：`#80ED99`
- 海盐绿：`#57CC99`
- 信息蓝：`#3B82F6`
- 风险橙：`#F59E0B`
- 危险红：`#EF4444`
- 深色代码底：`#0F172A`

使用规则：

- `#AACC00` 不作为全文主色，只用于品牌标识、成功状态、当前激活态、小面积强调。
- 渐变只用于品牌块、总览指标、关键状态条，不用于普通按钮和表单。
- 日志、代码、配置内容保持高可读的深色代码面板或白底文本面板。

### 4.2 渐变策略

推荐渐变：

```scss
linear-gradient(135deg, #AACC00 0%, #80ED99 48%, #57CC99 100%)
```

使用位置：

- App Shell 品牌标识。
- 总览页关键指标卡的顶部细条或图标底。
- 索引状态、工具可用性、扫描完成等正向状态。
- 空状态插画或轻量装饰线。

避免位置：

- 表格正文。
- 配置编辑器正文。
- 会话消息正文。
- 高风险操作按钮。

### 4.3 圆角、阴影与边框

PC 管理台需要克制：

- 基础控件圆角：`6px`
- 面板圆角：`8px`
- 品牌/状态大块圆角：`10px`
- 不使用超过 `12px` 的大圆角，除非是仪表盘里的特殊状态卡。

阴影策略：

- 默认不用重阴影。
- 面板使用边框 + 极轻阴影。
- 悬浮态只提升边框色或背景，不制造跳动感。

### 4.4 字体与信息密度

排版原则：

- 默认字号：`14px`
- 页面标题：`20px`
- 区块标题：`15px` 到 `16px`
- 辅助信息：`12px`
- 数字指标：`24px` 到 `32px`

信息密度：

- 这是 PC 管理台，不做移动端留白。
- 列表、表格、配置项保持可扫描。
- 总览页可以更有视觉层次，其它业务页优先效率。

## 5. Element Plus 与自研组件边界

### 5.1 不建议只做 Element Plus 全局配置

只改 Element Plus 全局配置的问题：

- 很难形成产品识别度，仍然像默认组件库。
- 页面骨架、指标卡、业务列表、状态摘要这些区域不是 Element Plus 的强项。
- 后续如果 mobile 独立建设，过度依赖 Element Plus 变量会让跨端设计语言难复用。

### 5.2 不建议一次性全量自研组件

全量替换的问题：

- 表格、表单、选择器、弹层、可访问性、键盘交互成本很高。
- 当前项目中型开源定位，更需要可维护和可贡献，而不是维护一整套低层 UI 库。
- 会拖慢业务功能迭代。

### 5.3 推荐分工

Element Plus 继续保留：

- `el-table`
- `el-input`
- `el-select`
- `el-button`
- `el-tag`
- `el-alert`
- `el-empty`
- `el-skeleton`
- `el-loading`
- 弹窗、抽屉、确认、消息反馈等后续可能引入的标准交互

自研封装优先建设：

- `DsAppShell`：系统骨架。
- `DsSidebar`：导航与品牌区。
- `DsPageHeader`：页面标题、说明、操作区。
- `DsToolbar`：筛选、刷新、批量操作。
- `DsPanel`：统一面板壳，替代直接到处写 `el-card`。
- `DsMetricCard`：总览指标卡。
- `DsStatusPill`：状态胶囊，内部可组合 `el-tag` 或纯 CSS。
- `DsSplitView`：左右分栏布局。
- `DsCodeBlock`：配置、日志、代码展示。
- `DsEmptyState`：统一空状态。

核心原则：

- 不封装低层表单控件来重复 Element Plus。
- 先封装高频页面结构和业务展示壳。
- 自研组件可以内部使用 Element Plus，但不要把 Element Plus 的 class 和变量泄漏给业务页面。

## 6. 推荐目录结构

```text
apps/web/src/
├── app/
│   └── AppShell.vue
├── components/
│   ├── chat/
│   ├── config/
│   └── design-system/
│       ├── DsAppFrame.vue
│       ├── DsCodeBlock.vue
│       ├── DsEmptyState.vue
│       ├── DsMetricCard.vue
│       ├── DsPageHeader.vue
│       ├── DsPanel.vue
│       ├── DsSplitView.vue
│       ├── DsStatusPill.vue
│       ├── DsToolbar.vue
│       └── index.ts
├── features/
│   ├── configs/
│   ├── files/
│   ├── logs/
│   ├── overview/
│   ├── sessions/
│   ├── skills/
│   └── trash/
├── plugins/
│   └── element-plus.ts
├── shared/
│   └── composables/
├── state/
└── styles/
    ├── base.scss
    ├── element-plus.scss
    ├── tokens.scss
    └── utilities.scss
```

文件职责：

- `tokens.scss`：颜色、间距、圆角、阴影、字体、z-index 等设计令牌。
- `element-plus.scss`：Element Plus CSS 变量映射和必要的全局修正。
- `base.scss`：HTML、body、字体、滚动、基础排版。
- `utilities.scss`：少量可复用工具类，例如 `.mono`、`.muted`、`.code-block`。
- `components/design-system`：PC 端自研系统组件，不放业务 API 请求。
- `features/*`：业务页面和 feature composable，组合设计系统组件和 Element Plus。

## 7. 设计令牌草案

```scss
$ds-color-text: #142033;
$ds-color-text-muted: #65738a;
$ds-color-page: #f5f8ff;
$ds-color-surface: #ffffff;
$ds-color-surface-soft: #f8fbff;
$ds-color-border: #dde6f3;
$ds-color-border-soft: #eaf0f8;

$ds-color-brand: #aacc00;
$ds-color-brand-soft: #80ed99;
$ds-color-brand-deep: #57cc99;
$ds-color-action: #168255;
$ds-color-action-hover: #1f9f67;
$ds-color-action-active: #0f6f46;
$ds-color-info: #3b82f6;
$ds-color-warning: #f59e0b;
$ds-color-danger: #ef4444;

$ds-radius-control: 6px;
$ds-radius-panel: 8px;
$ds-radius-feature: 10px;

$ds-shadow-panel: 0 10px 30px rgb(20 32 51 / 6%);
$ds-shadow-hover: 0 14px 36px rgb(20 32 51 / 9%);

$ds-space-1: 4px;
$ds-space-2: 8px;
$ds-space-3: 12px;
$ds-space-4: 16px;
$ds-space-5: 20px;
$ds-space-6: 24px;
```

后续实现时，建议同时输出 CSS 变量，方便运行时主题和 Element Plus 变量桥接：

```scss
:root {
  --ds-color-brand: #{$ds-color-brand};
  --ds-color-page: #{$ds-color-page};
  --ds-color-surface: #{$ds-color-surface};
  --ds-radius-panel: #{$ds-radius-panel};
}
```

## 8. Element Plus 主题桥接策略

建议新增 `apps/web/src/styles/element-plus.scss`，只做变量级桥接：

```scss
:root {
  --el-color-primary: var(--ds-color-action);
  --el-color-primary-dark-2: var(--ds-color-action-active);
  --el-color-primary-light-3: var(--ds-color-action-hover);
  --el-color-success: var(--ds-color-brand-deep);
  --el-color-warning: #f59e0b;
  --el-color-danger: #ef4444;
  --el-border-radius-base: 6px;
  --el-border-color: var(--ds-color-border);
  --el-fill-color-blank: var(--ds-color-surface);
  --el-bg-color: var(--ds-color-surface);
  --el-text-color-primary: var(--ds-color-text);
  --el-text-color-secondary: var(--ds-color-text-muted);
}
```

注意事项：

- 不要大量覆盖 `.el-xxx` 内部结构 class。
- 如果某个业务页面需要特殊视觉，优先通过 `DsPanel`、`DsMetricCard` 之类组件承接。
- Element Plus 的主色建议用信息蓝，品牌青柠用于状态和品牌，避免所有操作按钮都变成青柠色。

## 9. 核心组件规格

### 9.1 DsPanel

用途：

- 替代业务页直接散落的 `el-card`。
- 统一标题、右侧动作、边框、内边距、紧凑模式。

Props 建议：

- `title?: string`
- `description?: string`
- `compact?: boolean`
- `bordered?: boolean`

Slots 建议：

- `default`
- `actions`
- `header`

### 9.2 DsMetricCard

用途：

- 总览页工具状态、索引数量、配置数量、会话数量。

视觉：

- 左上图标或品牌渐变条。
- 大数字 + 单位 + 环比/状态。
- 正向状态使用青柠绿，异常状态使用橙/红。

### 9.3 DsPageHeader

用途：

- 统一页面标题、描述和操作区。
- 当前 `AppShell` 顶部只展示页面名，后续 feature 内部可用它表达页面上下文。

### 9.4 DsSplitView

用途：

- 会话列表 + 会话详情。
- 配置菜单 + 配置详情。
- 文件目录 + 文件内容。

要求：

- 固定 PC 最小宽度。
- 左侧列表区域可滚动。
- 右侧详情区域保留可阅读高度。

### 9.5 DsCodeBlock

用途：

- 配置文件、日志、会话原始内容。

要求：

- 等宽字体。
- 深色底。
- 支持长文本折行。
- 支持可选复制按钮，但复制功能单独实现，不耦合业务 API。

## 10. 页面级改造建议

### 10.1 总览页

改造方向：

- 从普通 `el-card` 网格升级为指标仪表盘。
- 每个工具一张 `DsMetricCard`，展示工具可用性、配置数、会话索引数、最后扫描时间。
- 顶部增加轻量状态横条，展示索引状态和刷新入口。

视觉强度：

- 可以使用最多的渐变和光感。
- 但卡片内容仍需清晰、可读。

### 10.2 配置管理

改造方向：

- 保留当前菜单 + 详情结构。
- 左侧使用 `DsPanel` 包住配置菜单。
- 右侧使用 `DsPageHeader` + `DsCodeBlock` / 配置编辑组件。

视觉强度：

- 中等。
- 编辑器区域不要使用花哨背景。

### 10.3 历史会话

改造方向：

- 使用 `DsSplitView` 统一左右布局。
- 项目组、会话项形成自研业务列表，而不是依赖 Element Plus 菜单。
- 消息渲染区保持阅读优先。

视觉强度：

- 低到中。
- 重点是层次、滚动稳定和阅读体验。

### 10.4 文件浏览、日志、回收站、技能管理

改造方向：

- 文件浏览：目录和内容都走 `DsSplitView`。
- 日志：`DsToolbar` + `DsCodeBlock`。
- 回收站：标准表格外包 `DsPanel`，危险操作保持红色。
- 技能管理：列表和详情使用统一面板。

## 11. 分阶段执行计划

### Phase D1：设计令牌落地

目标：

- 新增 `tokens.scss`、`element-plus.scss`、`utilities.scss`。
- `base.scss` 改为引用设计令牌。
- Element Plus 主色、边框、圆角、文字色完成变量桥接。

验收：

- 不改页面结构也能看到基础风格统一。
- `pnpm check`、`pnpm test`、`pnpm build` 通过。

### Phase D2：App Shell 升级

目标：

- 统一侧边栏、品牌标识、顶部栏。
- 品牌标识使用克制的青柠渐变。
- 导航激活态从默认 Element Plus 风格改成系统风格。

验收：

- 页面骨架有明确产品识别。
- 不影响路由和刷新索引功能。

### Phase D3：基础设计系统组件

目标：

- 新增 `DsPanel`、`DsPageHeader`、`DsToolbar`、`DsStatusPill`、`DsCodeBlock`。
- 先在 1 到 2 个页面试点，不全量替换。

验收：

- 新组件 API 简单，业务页面不需要知道 Element Plus 内部 class。
- 页面样式重复明显减少。

### Phase D4：总览页仪表盘化

目标：

- 新增 `DsMetricCard`。
- 总览页替换普通卡片为指标卡。
- 建立状态色和数字展示规范。

验收：

- 参考图二的管理平台感初步形成。
- 参考图一的青柠渐变只作为强调，不喧宾夺主。

### Phase D5：复杂页面分栏统一

目标：

- 新增 `DsSplitView`。
- 迁移会话、配置、文件浏览三类分栏页面。

验收：

- 三个页面的左右结构一致。
- 滚动区域和固定区域行为一致。

### Phase D6：收尾与文档固化

目标：

- 补充组件 README 或 Story 示例。
- 清理散落的重复 SCSS。
- 把新增组件使用规则写回架构路线图。

验收：

- 新页面开发可以优先复用 `components/design-system`。
- Element Plus 只作为底层交互能力，不再主导产品风格。

## 12. 迁移原则

- 不做移动端。
- 不一次性重写所有页面。
- 不为了视觉替换成熟表单和表格控件。
- 不把业务 API 写进设计系统组件。
- 不在 `packages/shared` 中放任何 UI 样式或 Vue 组件。
- 新增样式优先使用设计令牌，不在页面里散写随机颜色。
- 每个阶段结束后运行 `pnpm check`、`pnpm test`、`pnpm build`。

## 13. 最终状态

完成后，`apps/web` 应该呈现为：

- 有统一品牌气质的 PC 管理台。
- Element Plus 被控制在基础交互层。
- 页面结构由自研设计系统组件统一。
- 业务 feature 只关心数据和组合，不再重复处理通用壳样式。
- 后续 mobile 可以借鉴颜色、状态、信息层级，但独立实现移动端组件。

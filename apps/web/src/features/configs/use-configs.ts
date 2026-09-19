import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { AiTool, ConfigFileCategory, ConfigFileDetail } from '@ai-manage/shared';
import { api } from '../../api';
import { refreshRevision, selectedTool } from '../../state/app-state';

export type MenuSection = 'root' | 'markdown' | 'group';
export type RootMenuKind = 'model' | 'behavior';

export interface ConfigMenuItem {
  id: string;
  fileId: string;
  section: MenuSection;
  key?: string;
  rootKind?: RootMenuKind;
  label: string;
  description: string;
}

export type FieldMeta = {
  label: string;
  description: string;
  options?: Array<{ label: string; value: string }>;
};

export interface ConfigGroupItemEntry {
  key: string;
  value: unknown;
}

const markdownInputStyle = { minHeight: '560px', height: '560px' };
const MODEL_PROVIDER_KEY = 'model_provider';
const MODEL_PROVIDERS_KEY = 'model_providers';
const MODEL_KEY = 'model';
const MODEL_REASONING_EFFORT_KEY = 'model_reasoning_effort';
const ENV_KEY = 'env';
const CLAUDE_ENV_PROVIDER_KEY = 'claude-env';
const MODEL_ROOT_KEYS = new Set([
  MODEL_KEY,
  MODEL_PROVIDER_KEY,
  MODEL_REASONING_EFFORT_KEY,
  'modelProvider',
  'defaultModel',
  'default_model',
  'defaultModelProvider',
  'default_model_provider',
]);
const SPLIT_GROUP_KEYS = new Set([
  'model_providers',
  'projects',
  'marketplaces',
  'extraKnownMarketplaces',
  'plugins',
  'enabledPlugins',
  'mcp_servers',
]);

const FIELD_META: Record<string, FieldMeta> = {
  model_provider: {
    label: '模型供应商',
    description: '选择 Codex 默认调用哪个模型供应商配置。',
  },
  model: {
    label: '默认模型',
    description: '修改 Codex 默认使用的模型名称。',
  },
  model_reasoning_effort: {
    label: '推理强度',
    description: '控制模型推理投入，通常是 low、medium、high。',
    options: [
      { label: '低', value: 'low' },
      { label: '中', value: 'medium' },
      { label: '高', value: 'high' },
    ],
  },
  disable_response_storage: {
    label: '禁用响应存储',
    description: '开启后尽量不保存模型响应内容。',
  },
  notify: {
    label: '通知命令',
    description: '任务结束或事件触发时执行的本地通知命令参数。',
  },
  name: {
    label: '名称',
    description: '当前对象的显示名称或供应商名称。',
  },
  base_url: {
    label: '接口地址',
    description: '模型或服务请求的基础 URL。',
  },
  wire_api: {
    label: '接口协议',
    description: '该供应商使用的 API 协议格式。',
  },
  trust_level: {
    label: '信任级别',
    description: '控制当前项目目录允许 Codex 执行操作的信任等级。',
    options: [
      { label: '可信任', value: 'trusted' },
      { label: '不信任', value: 'untrusted' },
    ],
  },
  enabled: {
    label: '启用',
    description: '控制该功能、插件或配置项是否启用。',
  },
  env: {
    label: '模型配置',
    description: 'Claude Code 启动和运行时使用的模型供应商配置。',
  },
  permissions: {
    label: '权限规则',
    description: 'Claude Code 允许或拒绝执行的工具/命令规则。',
  },
  allow: {
    label: '允许规则',
    description: '明确允许执行的工具或命令列表。',
  },
  deny: {
    label: '拒绝规则',
    description: '明确禁止执行的工具或命令列表。',
  },
  enableAllProjectMcpServers: {
    label: '启用所有项目 MCP 服务',
    description: '是否默认启用项目内声明的 MCP 服务。',
  },
  enabledMcpjsonServers: {
    label: 'MCP 服务',
    description: '选择启用哪些 mcp.json 中声明的服务。',
  },
  enabledPlugins: {
    label: '插件',
    description: 'Claude 当前启用的插件配置。',
  },
  extraKnownMarketplaces: {
    label: '市场源',
    description: 'Claude 额外识别的插件市场来源。',
  },
  type: {
    label: '类型',
    description: '当前配置对象的类型。',
  },
  url: {
    label: '地址',
    description: '远程资源、市场源或服务连接地址。',
  },
  command: {
    label: '启动命令',
    description: '启动本地服务或工具时执行的命令。',
  },
  args: {
    label: '命令参数',
    description: '启动命令后附加的参数列表。',
  },
};

/**
 * Encapsulates configuration menu, draft editing, dirty checks, and section saving for the PC config page.
 */
export function useConfigs() {
  const configDetails = ref<ConfigFileDetail[]>([]);
  const selectedMenuId = ref('');
  const selectedConfig = ref<ConfigFileDetail>();
  const draftModel = ref<unknown>({});
  const draftRaw = ref('');
  const savingSection = ref('');
  const loadingDetail = ref(false);

  const menuItems = computed(() => configDetails.value.flatMap(detail => menuItemsForDetail(detail)));
  const selectedMenuItem = computed(() => menuItems.value.find(item => item.id === selectedMenuId.value));
  const draftRecord = computed(() => (isRecord(draftModel.value) ? draftModel.value : {}));
  const originalRecord = computed(() => (
    selectedConfig.value && isRecord(selectedConfig.value.formModel)
      ? selectedConfig.value.formModel
      : {}
  ));
  const activeRootKind = computed(() => selectedMenuItem.value?.rootKind);
  const rootFields = computed(() => Object.fromEntries(
    Object.entries(draftRecord.value)
      .filter(([key, value]) => activeRootKind.value && isRootFieldForKind(key, value, activeRootKind.value)),
  ));
  const originalRootFields = computed(() => Object.fromEntries(
    Object.entries(originalRecord.value)
      .filter(([key, value]) => activeRootKind.value && isRootFieldForKind(key, value, activeRootKind.value)),
  ));

  const markdownDirty = computed(() => !!selectedConfig.value && draftRaw.value !== selectedConfig.value.raw);
  const rootDirty = computed(() => stableString(rootFields.value) !== stableString(originalRootFields.value));
  const formDirty = computed(() => {
    if (!selectedConfig.value) return false;
    if (selectedMenuItem.value?.section === 'markdown') return markdownDirty.value;
    if (selectedMenuItem.value?.section === 'root') return rootDirty.value;
    return selectedMenuItem.value?.key ? isGroupDirty(selectedMenuItem.value.key) : false;
  });
  const isDirty = computed(() => formDirty.value);

  /**
   * Loads all editable config details for the currently selected AI tool.
   */
  async function loadConfigs() {
    const files = await api.configFiles(selectedTool.value);
    configDetails.value = await Promise.all(files.map(file => api.configFile(file.id)));
    if (!menuItems.value.some(item => item.id === selectedMenuId.value)) {
      const first = menuItems.value[0];
      if (first) selectMenu(first.id);
      else clearSelection();
      return;
    }
    const current = selectedMenuItem.value;
    if (current) applyDetail(requireDetail(current.fileId), current.id);
  }

  /**
   * Selects a config menu item and rebuilds the edit draft from its detail.
   */
  function selectMenu(id: string) {
    const item = menuItems.value.find(menuItem => menuItem.id === id);
    if (!item) return;
    applyDetail(requireDetail(item.fileId), item.id);
  }

  /**
   * Reloads the active config file from the backend and keeps the same menu item selected.
   */
  async function reloadSelected() {
    if (!selectedConfig.value || !selectedMenuItem.value) return;
    loadingDetail.value = true;
    try {
      const detail = await api.configFile(selectedConfig.value.id);
      replaceDetail(detail);
      applyDetail(detail, selectedMenuItem.value.id);
    } finally {
      loadingDetail.value = false;
    }
  }

  /**
   * Applies a config detail to the current editor draft.
   */
  function applyDetail(detail: ConfigFileDetail, menuId: string) {
    selectedConfig.value = detail;
    selectedMenuId.value = menuId;
    draftRaw.value = detail.raw;
    draftModel.value = clone(detail.formModel ?? detail.parsed ?? {});
  }

  /**
   * Replaces a cached config detail after reload or save.
   */
  function replaceDetail(detail: ConfigFileDetail) {
    configDetails.value = replaceDetailInList(configDetails.value, detail);
  }

  /**
   * Finds a loaded config detail or fails loudly when menu state is inconsistent.
   */
  function requireDetail(id: string) {
    const detail = configDetails.value.find(item => item.id === id);
    if (!detail) throw new Error('Config detail not found');
    return detail;
  }

  /**
   * Clears all selection state when no editable config exists.
   */
  function clearSelection() {
    selectedConfig.value = undefined;
    selectedMenuId.value = '';
    draftRaw.value = '';
    draftModel.value = {};
  }

  /**
   * Restores the current draft to the last loaded config detail.
   */
  function resetDraft() {
    if (!selectedConfig.value) return;
    draftRaw.value = selectedConfig.value.raw;
    draftModel.value = clone(selectedConfig.value.formModel ?? selectedConfig.value.parsed ?? {});
  }

  /**
   * Saves the markdown instruction body as raw text.
   */
  async function saveMarkdownSection() {
    await saveSection('markdown', () => ({
      mode: 'raw' as const,
      raw: draftRaw.value,
    }));
  }

  /**
   * Saves scalar root fields while preserving unchanged object groups.
   */
  async function saveRootSection() {
    await saveSection('root', () => ({
      mode: 'parsed' as const,
      parsed: modelWithRootFields(),
    }));
  }

  /**
   * Saves a top-level config group.
   */
  async function saveGroupSection(key: string) {
    await saveSection(key, () => ({
      mode: 'parsed' as const,
      parsed: (() => {
        const baseModel = clone(selectedConfig.value?.formModel ?? {});
        const base = isRecord(baseModel) ? baseModel : {};
        return {
          ...base,
          [key]: clone(draftRecord.value[key]),
        };
      })(),
    }));
  }

  /**
   * Saves a single item inside a split config group.
   */
  async function saveGroupItemSection(groupKey: string, itemKey: string) {
    await saveSection(sectionId(groupKey, itemKey), () => ({
      mode: 'parsed' as const,
      parsed: modelWithGroupItem(groupKey, itemKey),
    }));
  }

  /**
   * Saves one logical section with hash-based conflict checking and backend backup creation.
   */
  async function saveSection(
    section: string,
    payload: () => { mode: 'parsed'; parsed: unknown } | { mode: 'raw'; raw: string },
  ) {
    if (!selectedConfig.value || !selectedMenuItem.value) return false;
    savingSection.value = section;
    try {
      const body = payload();
      const response = await api.saveConfigFile(selectedConfig.value.id, {
        expectedHash: selectedConfig.value.hash,
        ...body,
      });
      replaceDetail(response.detail);
      applyDetail(response.detail, selectedMenuItem.value.id);
      ElMessage.success(`本配置项已保存，备份：${response.backupPath}`);
      return true;
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      savingSection.value = '';
    }
  }

  /**
   * Builds a parsed config model with updated root scalar fields.
   */
  function modelWithRootFields() {
    const base = clone(selectedConfig.value?.formModel ?? {});
    if (!isRecord(base)) return clone(rootFields.value);
    const rootKind = activeRootKind.value;
    for (const [key, value] of Object.entries(base)) {
      if (rootKind && isRootFieldForKind(key, value, rootKind)) delete base[key];
    }
    return {
      ...base,
      ...clone(rootFields.value),
    };
  }

  /**
   * Builds a parsed config model with one nested group item replaced.
   */
  function modelWithGroupItem(groupKey: string, itemKey: string) {
    const draftGroup = isRecord(draftRecord.value[groupKey]) ? draftRecord.value[groupKey] : {};
    return modelWithGroupItemValue(groupKey, itemKey, draftGroup[itemKey]);
  }

  /**
   * Builds a parsed config model with one nested group item set to a provided value.
   */
  function modelWithGroupItemValue(groupKey: string, itemKey: string, value: unknown) {
    const baseModel = clone(selectedConfig.value?.formModel ?? {});
    const base = isRecord(baseModel) ? baseModel : {};
    const originalGroup = isRecord(base[groupKey]) ? base[groupKey] : {};
    return {
      ...base,
      [groupKey]: {
        ...originalGroup,
        [itemKey]: clone(value),
      },
    };
  }

  /** Checks whether a top-level object group differs from the loaded config. */
  function isGroupDirty(key: string) {
    return stableString(draftRecord.value[key]) !== stableString(originalRecord.value[key]);
  }

  /**
   * Checks whether a single split group item differs from the loaded config.
   */
  function isGroupItemDirty(groupKey: string, itemKey: string) {
    const draftGroup = isRecord(draftRecord.value[groupKey]) ? draftRecord.value[groupKey] : {};
    const originalGroup = isRecord(originalRecord.value[groupKey]) ? originalRecord.value[groupKey] : {};
    return stableString(draftGroup[itemKey]) !== stableString(originalGroup[itemKey]);
  }

  /**
   * Replaces root scalar fields in the current draft model.
   */
  function updateRootFields(value: unknown) {
    if (!isRecord(value)) return;
    const rootKind = activeRootKind.value;
    const next = { ...draftRecord.value };
    for (const [key, fieldValue] of Object.entries(next)) {
      if (rootKind && isRootFieldForKind(key, fieldValue, rootKind)) delete next[key];
    }
    Object.assign(next, value);
    draftModel.value = next;
  }

  /**
   * Replaces a top-level object group in the current draft model.
   */
  function updateGroup(key: string, value: unknown) {
    draftModel.value = {
      ...draftRecord.value,
      [key]: value,
    };
  }

  /**
   * Replaces one item inside a top-level group in the current draft model.
   */
  function updateGroupItem(groupKey: string, itemKey: string, value: unknown) {
    const group = isRecord(draftRecord.value[groupKey]) ? draftRecord.value[groupKey] : {};
    updateGroup(groupKey, {
      ...group,
      [itemKey]: value,
    });
  }

  /**
   * Updates and saves a boolean-only group item from the card switch.
   */
  async function toggleGroupItemSection(groupKey: string, itemKey: string, enabled: boolean) {
    const group = isRecord(draftRecord.value[groupKey]) ? draftRecord.value[groupKey] : {};
    const nextValue = booleanGroupItemValue(group[itemKey], enabled);
    updateGroupItem(groupKey, itemKey, nextValue);
    await saveSection(sectionId(groupKey, itemKey), () => ({
      mode: 'parsed' as const,
      parsed: modelWithGroupItemValue(groupKey, itemKey, nextValue),
    }));
  }

  /**
   * Returns whether a group should be edited as individual child sections.
   */
  function shouldSplitGroup(key: string) {
    return SPLIT_GROUP_KEYS.has(key);
  }

  /**
   * Returns entries for a split config group.
   */
  function groupItemEntries(groupKey: string): ConfigGroupItemEntry[] {
    const group = draftRecord.value[groupKey];
    if (!isRecord(group)) return [];
    return Object.entries(group).map(([key, value]) => ({ key, value }));
  }

  /**
   * Builds a stable saving-section id for a split group item.
   */
  function sectionId(groupKey: string, itemKey: string) {
    return `${groupKey}:${itemKey}`;
  }

  /**
   * Resolves the display label for a split group item.
   */
  function itemLabel(groupKey: string, itemKey: string) {
    if (groupKey === 'projects') return basenameFromPath(itemKey);
    if (groupKey === 'plugins' || groupKey === 'enabledPlugins') return pluginNameFromKey(itemKey);
    return configFieldMeta(fieldPath(groupKey), itemKey).label;
  }

  /**
   * Resolves the helper description for a split group item.
   */
  function itemDescription(groupKey: string, itemKey: string) {
    if (groupKey === 'projects') return '项目路径对应的项目配置。';
    if (groupKey === 'model_providers') return '模型供应商的接口地址、协议和认证配置。';
    if (groupKey === 'marketplaces' || groupKey === 'extraKnownMarketplaces') return '插件市场源的地址和来源配置。';
    if (groupKey === 'plugins' || groupKey === 'enabledPlugins') return '插件启用状态和插件级配置。';
    if (groupKey === 'mcp_servers') return 'MCP 服务连接和启动参数。';
    return configFieldMeta(fieldPath(groupKey), itemKey).description || '配置子项。';
  }

  /**
   * Builds a field path consumed by the recursive config object editor.
   */
  function fieldPath(section: string) {
    return [selectedConfig.value?.tool || 'codex', section];
  }

  watch([selectedTool, refreshRevision], loadConfigs, { immediate: true });

  return {
    selectedMenuId,
    menuItems,
    selectedMenuItem,
    isDirty,
    selectedConfig,
    draftRaw,
    savingSection,
    loadingDetail,
    markdownInputStyle,
    markdownDirty,
    rootDirty,
    rootFields,
    draftRecord,
    selectMenu,
    resetDraft,
    reloadSelected,
    toolLabel,
    categoryLabel,
    formatSize,
    saveMarkdownSection,
    saveRootSection,
    fieldPath,
    configFieldMeta,
    updateRootFields,
    shouldSplitGroup,
    groupItemEntries,
    itemLabel,
    itemDescription,
    isGroupItemDirty,
    sectionId,
    saveGroupItemSection,
    toggleGroupItemSection,
    updateGroupItem,
    isGroupDirty,
    saveGroupSection,
    updateGroup,
  };
}

/**
 * Applies a card switch value to either a bare boolean item or an `{ enabled }` object.
 */
function booleanGroupItemValue(value: unknown, enabled: boolean) {
  if (typeof value === 'boolean') return enabled;
  if (isRecord(value)) return { ...value, enabled };
  return enabled;
}

/**
 * Resolves editor metadata for known config fields and contextual nested fields.
 */
function configFieldMeta(path: string[], key: string): FieldMeta {
  const fullKey = [...path.slice(1), key].join('.');
  const exact = FIELD_META[fullKey] || FIELD_META[key];
  if (exact) return exact;
  if (path.includes('projects')) {
    return {
      label: projectFieldLabel(key),
      description: key.startsWith('/') ? '项目路径对应的项目配置。' : '这个项目下的具体配置。',
    };
  }
  if (path.includes('plugins')) {
    return {
      label: pluginFieldLabel(key),
      description: key.includes('@') ? '插件名称对应的插件配置。' : '这个插件的启用状态或插件级参数。',
    };
  }
  if (path.includes('mcp_servers')) {
    return { label: mcpFieldLabel(key), description: 'MCP 服务连接参数。' };
  }
  return { label: key, description: '高级配置项，当前保留原始字段名。' };
}

/**
 * Resolves a project field label from a path-like key.
 */
function projectFieldLabel(key: string) {
  if (key.startsWith('/')) return basenameFromPath(key);
  return FIELD_META[key]?.label || key;
}

/**
 * Resolves a plugin field label from a package-like key.
 */
function pluginFieldLabel(key: string) {
  if (key.includes('@')) return pluginNameFromKey(key);
  return FIELD_META[key]?.label || key;
}

/**
 * Resolves an MCP field label.
 */
function mcpFieldLabel(key: string) {
  return FIELD_META[key]?.label || key;
}

/**
 * Extracts the last meaningful path segment for display.
 */
function basenameFromPath(path: string) {
  return path.split('/').filter(Boolean).at(-1) || path;
}

/**
 * Extracts a concise plugin name from a package key.
 */
function pluginNameFromKey(key: string) {
  const packageName = key.split('@')[0] || key;
  return packageName.split('/').filter(Boolean).at(-1) || packageName;
}

/**
 * Builds editable menu sections for a config file detail.
 */
function menuItemsForDetail(detail: ConfigFileDetail): ConfigMenuItem[] {
  if (detail.formKind === 'markdown-instruction') {
    return [{
      id: `${detail.id}:markdown`,
      fileId: detail.id,
      section: 'markdown',
      label: detail.tool === 'codex' ? 'Codex 全局指令' : 'Claude 全局指令',
      description: '控制工具默认行为、协作规则和编码约定',
    }];
  }

  const record = isRecord(detail.formModel) ? detail.formModel : {};
  const items: ConfigMenuItem[] = [];
  const root = Object.entries(record).filter(([, value]) => !isRecord(value));
  const modelRoot = root.filter(([key]) => isModelRootKey(key));
  const behaviorRoot = root.filter(([key]) => !isModelRootKey(key));
  const hasModelProviders = isRecord(record[MODEL_PROVIDERS_KEY])
    || (detail.tool === 'claude' && isRecord(record[ENV_KEY]));
  if (modelRoot.length || hasModelProviders) {
    items.push({
      id: `${detail.id}:root:model`,
      fileId: detail.id,
      section: 'root',
      rootKind: 'model',
      label: '模型配置',
      description: '默认模型、供应商连接和推理强度',
    });
  }
  if (behaviorRoot.length) {
    items.push({
      id: `${detail.id}:root:behavior`,
      fileId: detail.id,
      section: 'root',
      rootKind: 'behavior',
      label: '全局行为',
      description: '通知、存储和运行时默认行为',
    });
  }
  Object.entries(record)
    .filter(([key, value]) => (
      key !== 'desktop'
      && key !== MODEL_PROVIDERS_KEY
      && !(detail.tool === 'claude' && key === ENV_KEY)
      && key !== 'mcp_servers'
      && isRecord(value)
    ))
    .forEach(([key]) => {
      items.push({
        id: `${detail.id}:group:${key}`,
        fileId: detail.id,
        section: 'group',
        key,
        label: groupLabel(key),
        description: groupDescription(key),
      });
    });
  return items;
}

/**
 * Returns whether a root-level config key belongs to model selection behavior.
 */
function isModelRootKey(key: string) {
  if (MODEL_ROOT_KEYS.has(key)) return true;
  const normalized = key.toLowerCase();
  return normalized.endsWith('model') || normalized.includes('model_') || normalized.includes('modelprovider');
}

/**
 * Returns whether a non-object root-level field belongs to a logical root menu section.
 */
function isRootFieldForKind(key: string, value: unknown, kind: RootMenuKind) {
  if (isRecord(value)) return false;
  if (kind === 'model' && [MODEL_PROVIDER_KEY, MODEL_KEY, MODEL_REASONING_EFFORT_KEY].includes(key)) return false;
  const isModelField = isModelRootKey(key);
  return kind === 'model' ? isModelField : !isModelField;
}

/**
 * Extracts the model provider object map from a parsed config record.
 */
function modelProvidersRecord(record: Record<string, unknown>): Record<string, unknown> {
  const providers = record[MODEL_PROVIDERS_KEY];
  return isRecord(providers) ? providers : {};
}

/**
 * Replaces one cached config detail after refresh or save.
 */
function replaceDetailInList(items: ConfigFileDetail[], detail: ConfigFileDetail) {
  return items.map(item => item.id === detail.id ? detail : item);
}

/**
 * Returns a human-readable AI tool name.
 */
function toolLabel(tool: AiTool) {
  return tool === 'codex' ? 'Codex' : 'Claude';
}

/**
 * Returns a human-readable config file category.
 */
function categoryLabel(category: ConfigFileCategory) {
  if (category === 'config') return '主配置';
  if (category === 'instruction') return '指令文件';
  if (category === 'cache') return '缓存';
  if (category === 'history') return '历史';
  if (category === 'index') return '索引';
  return '运行状态';
}

/**
 * Returns a human-readable group label.
 */
function groupLabel(key: string) {
  const labels: Record<string, string> = {
    env: '模型配置',
    permissions: '权限配置',
    projects: '项目配置',
    model_providers: '模型供应商',
    marketplaces: '市场源',
    extraKnownMarketplaces: '市场源',
    enabledPlugins: '插件',
    plugins: '插件',
    features: '功能开关',
    desktop: '桌面端配置',
    codeforge: 'CodeForge',
  };
  return labels[key] || key;
}

/**
 * Returns a human-readable group description.
 */
function groupDescription(key: string) {
  const descriptions: Record<string, string> = {
    env: '模型供应商、接口地址和认证变量',
    permissions: '工具权限、允许/拒绝规则和本地授权',
    projects: '不同项目路径下的信任级别和项目配置',
    model_providers: '模型供应商、接口地址和认证方式',
    marketplaces: 'Codex 插件市场来源',
    extraKnownMarketplaces: '插件市场来源',
    enabledPlugins: '插件启用状态和插件级配置',
    plugins: '插件启用状态和插件级设置',
    features: '实验功能和能力开关',
    desktop: '桌面端偏好、打开方式和路径规则',
    codeforge: 'CodeForge 相关本地配置',
  };
  return descriptions[key] || '高级对象配置';
}

/**
 * Formats byte size for compact config metadata.
 */
function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Formats unknown scalar-like values for compact provider summaries.
 */
function formatScalar(value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * Narrows unknown values to plain non-array records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Creates a JSON-compatible deep clone for editable config drafts.
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Serializes config snippets for simple structural dirty checks.
 */
function stableString(value: unknown) {
  return JSON.stringify(value);
}

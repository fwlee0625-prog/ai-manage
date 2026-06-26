import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { AiTool, ConfigFileDetail } from '@ai-manage/shared';
import { api } from '../../api';
import { refreshRevision, selectedTool } from '../../state/app-state';

export type McpServerKind = 'command' | 'remote' | 'other';
export type McpServerFilter = 'all' | McpServerKind;

export interface McpServerSummary {
  id: string;
  fileId: string;
  tool: AiTool;
  name: string;
  configName: string;
  configPath: string;
  value: unknown;
  kind: McpServerKind;
  commandPreview: string;
}

export type McpFieldMeta = {
  label: string;
  description?: string;
  options?: Array<{ label: string; value: string }>;
};

const MCP_SERVERS_KEY = 'mcp_servers';
const mcpFilterOptions: Array<{ label: string; value: McpServerFilter }> = [
  { label: '全部', value: 'all' },
  { label: '命令', value: 'command' },
  { label: '远程', value: 'remote' },
];

/**
 * Owns MCP server list extraction, filtering, selection, and per-server saving.
 */
export function useMcpServers() {
  const configDetails = ref<ConfigFileDetail[]>([]);
  const selectedServerId = ref('');
  const draftServer = ref<unknown>({});
  const serverFilter = ref<McpServerFilter>('all');
  const loadingList = ref(false);
  const saving = ref(false);

  const servers = computed(() => configDetails.value.flatMap(detail => mcpServersFromDetail(detail)));
  const filteredServers = computed(() => {
    if (serverFilter.value === 'all') return servers.value;
    return servers.value.filter(server => server.kind === serverFilter.value);
  });
  const selectedServer = computed(() => servers.value.find(server => server.id === selectedServerId.value));
  const isDirty = computed(() => !!selectedServer.value && stableString(draftServer.value) !== stableString(selectedServer.value.value));

  /**
   * Loads editable configuration files and extracts top-level MCP server entries.
   */
  async function loadMcpServers() {
    loadingList.value = true;
    try {
      const files = await api.configFiles(selectedTool.value);
      configDetails.value = await Promise.all(files.map(file => api.configFile(file.id)));
      if (!servers.value.some(server => server.id === selectedServerId.value)) {
        selectedServerId.value = '';
        draftServer.value = {};
      }
    } finally {
      loadingList.value = false;
    }
  }

  /**
   * Opens a server entry in the detail drawer by cloning its current config.
   */
  function selectServer(id: string) {
    const server = servers.value.find(item => item.id === id);
    if (!server) return;
    selectedServerId.value = server.id;
    draftServer.value = clone(server.value);
  }

  /**
   * Restores the selected server draft to the last loaded config value.
   */
  function resetDraft() {
    if (!selectedServer.value) return;
    draftServer.value = clone(selectedServer.value.value);
  }

  /**
   * Persists only the selected MCP server entry back to its source config file.
   */
  async function saveServer() {
    const server = selectedServer.value;
    if (!server) return;
    const detail = configDetails.value.find(item => item.id === server.fileId);
    if (!detail) return;

    saving.value = true;
    try {
      const response = await api.saveConfigFile(detail.id, {
        expectedHash: detail.hash,
        mode: 'parsed',
        parsed: modelWithServer(detail, server.name, draftServer.value),
      });
      replaceDetail(response.detail);
      const updated = servers.value.find(item => item.id === server.id);
      if (updated) draftServer.value = clone(updated.value);
      ElMessage.success(`MCP 服务器已保存，备份：${response.backupPath}`);
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    } finally {
      saving.value = false;
    }
  }

  /**
   * Returns the display label and helper text for MCP server editor fields.
   */
  function mcpFieldMeta(_path: string[], key: string): McpFieldMeta {
    const meta: Record<string, McpFieldMeta> = {
      command: { label: '启动命令', description: '启动本地 MCP 服务时执行的命令。' },
      args: { label: '命令参数', description: '启动命令后附加的参数列表。' },
      env: { label: '环境变量', description: 'MCP 服务启动时注入的环境变量。' },
      type: { label: '类型', description: 'MCP 服务连接类型。' },
      url: { label: '地址', description: '远程 MCP 服务连接地址。' },
      base_url: { label: '接口地址', description: '远程 MCP 服务基础地址。' },
      enabled: { label: '启用', description: '控制该 MCP 服务是否启用。' },
      disabled: { label: '禁用', description: '控制该 MCP 服务是否禁用。' },
    };
    return meta[key] || { label: key, description: 'MCP 服务连接参数。' };
  }

  function toolLabel(tool: AiTool) {
    return tool === 'codex' ? 'Codex' : 'Claude';
  }

  function kindLabel(kind: McpServerKind) {
    if (kind === 'command') return '命令';
    if (kind === 'remote') return '远程';
    return '其他';
  }

  function kindTagType(kind: McpServerKind) {
    if (kind === 'command') return 'success';
    if (kind === 'remote') return 'warning';
    return 'info';
  }

  function replaceDetail(detail: ConfigFileDetail) {
    configDetails.value = configDetails.value.map(item => item.id === detail.id ? detail : item);
  }

  watch([selectedTool, refreshRevision], loadMcpServers, { immediate: true });

  return {
    servers,
    filteredServers,
    selectedServer,
    draftServer,
    serverFilter,
    mcpFilterOptions,
    loadingList,
    saving,
    isDirty,
    loadMcpServers,
    selectServer,
    resetDraft,
    saveServer,
    mcpFieldMeta,
    toolLabel,
    kindLabel,
    kindTagType,
  };
}

/**
 * Extracts MCP server entries from a parsed config file detail.
 */
function mcpServersFromDetail(detail: ConfigFileDetail): McpServerSummary[] {
  const model = isRecord(detail.formModel) ? detail.formModel : {};
  const group = isRecord(model[MCP_SERVERS_KEY]) ? model[MCP_SERVERS_KEY] : {};
  return Object.entries(group).map(([name, value]) => ({
    id: `${detail.id}:${MCP_SERVERS_KEY}:${name}`,
    fileId: detail.id,
    tool: detail.tool,
    name,
    configName: detail.name,
    configPath: detail.path,
    value,
    kind: serverKind(value),
    commandPreview: commandPreview(value),
  }));
}

/**
 * Builds a full parsed config model with one MCP server replaced.
 */
function modelWithServer(detail: ConfigFileDetail, serverName: string, value: unknown) {
  const baseModel = clone(detail.formModel ?? {});
  const base = isRecord(baseModel) ? baseModel : {};
  const group = isRecord(base[MCP_SERVERS_KEY]) ? base[MCP_SERVERS_KEY] : {};
  return {
    ...base,
    [MCP_SERVERS_KEY]: {
      ...group,
      [serverName]: clone(value),
    },
  };
}

/**
 * Classifies an MCP server by the fields present in its config object.
 */
function serverKind(value: unknown): McpServerKind {
  if (!isRecord(value)) return 'other';
  if (typeof value.command === 'string' || Array.isArray(value.args)) return 'command';
  if (typeof value.url === 'string' || typeof value.base_url === 'string' || typeof value.type === 'string') return 'remote';
  return 'other';
}

/**
 * Creates a compact one-line command or endpoint summary for card display.
 */
function commandPreview(value: unknown) {
  if (!isRecord(value)) return '暂无连接参数';
  if (typeof value.command === 'string') {
    const args = Array.isArray(value.args) ? value.args.map(item => String(item)).join(' ') : '';
    return [value.command, args].filter(Boolean).join(' ');
  }
  if (typeof value.url === 'string') return value.url;
  if (typeof value.base_url === 'string') return value.base_url;
  if (typeof value.type === 'string') return value.type;
  return '暂无连接参数';
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
 * Serializes config snippets for structural dirty checks.
 */
function stableString(value: unknown) {
  return JSON.stringify(value);
}

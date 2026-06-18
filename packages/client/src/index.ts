import type {
  AiTool,
  ClearTrashSessionsResponse,
  ConfigFileDetail,
  ConfigFileSummary,
  DeleteSessionResponse,
  IndexStatus,
  LogEntry,
  PaginatedResult,
  ProjectSummary,
  RestoreTrashSessionResponse,
  SaveConfigFileRequest,
  SaveConfigFileResponse,
  SaveSkillRequest,
  SaveSkillResponse,
  SessionDetail,
  SessionSummary,
  SessionsQuery,
  SkillDetail,
  SkillSummary,
  ToolDirectoryListing,
  ToolFilePreview,
  ToolStatus,
  TrashSessionDetail,
  TrashSessionFilePreview,
  TrashSessionSummary,
} from '@ai-manage/shared';

export interface AiManageClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Creates a typed API client for the AI Manage backend.
 */
export function createAiManageClient(options: AiManageClientOptions = {}) {
  const baseUrl = options.baseUrl ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    tools: () => request<ToolStatus>(fetchImpl, baseUrl, '/api/tools'),
    indexStatus: (tool?: AiTool) => request<IndexStatus>(fetchImpl, baseUrl, `/api/index/status${tool ? `?tool=${tool}` : ''}`),
    refresh: (tool?: AiTool) => request(fetchImpl, baseUrl, '/api/index/refresh', {
      method: 'POST',
      body: JSON.stringify({ tool }),
    }),
    configFiles: (tool?: AiTool) => request<ConfigFileSummary[]>(fetchImpl, baseUrl, `/api/config-files${tool ? `?tool=${tool}` : ''}`),
    configFile: (id: string) => request<ConfigFileDetail>(fetchImpl, baseUrl, `/api/config-files/${id}`),
    saveConfigFile: (id: string, body: SaveConfigFileRequest) => request<SaveConfigFileResponse>(fetchImpl, baseUrl, `/api/config-files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    skills: () => request<SkillSummary[]>(fetchImpl, baseUrl, '/api/skills'),
    skill: (id: string) => request<SkillDetail>(fetchImpl, baseUrl, `/api/skills/${id}`),
    saveSkill: (id: string, body: SaveSkillRequest) => request<SaveSkillResponse>(fetchImpl, baseUrl, `/api/skills/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    files: (tool: AiTool, path = '') => {
      const params = new URLSearchParams({ tool });
      if (path) params.set('path', path);
      return request<ToolDirectoryListing>(fetchImpl, baseUrl, `/api/files?${params.toString()}`);
    },
    filePreview: (tool: AiTool, path: string) => {
      const params = new URLSearchParams({ tool, path });
      return request<ToolFilePreview>(fetchImpl, baseUrl, `/api/files/preview?${params.toString()}`);
    },
    sessions: (query: SessionsQuery) => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return request<PaginatedResult<SessionSummary>>(fetchImpl, baseUrl, `/api/sessions?${params.toString()}`);
    },
    projects: (tool?: AiTool) => request<ProjectSummary[]>(fetchImpl, baseUrl, `/api/projects${tool ? `?tool=${tool}` : ''}`),
    session: (tool: AiTool, id: string) => request<SessionDetail>(fetchImpl, baseUrl, `/api/sessions/${tool}/${encodeURIComponent(id)}`),
    deleteSession: (tool: AiTool, id: string) => request<DeleteSessionResponse>(fetchImpl, baseUrl, `/api/sessions/${tool}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
    trashSessions: (tool?: AiTool) => request<TrashSessionSummary[]>(fetchImpl, baseUrl, `/api/trash/sessions${tool ? `?tool=${tool}` : ''}`),
    trashSession: (trashId: string) => request<TrashSessionDetail>(fetchImpl, baseUrl, `/api/trash/sessions/${encodeURIComponent(trashId)}`),
    trashFilePreview: (trashId: string, index: number) => request<TrashSessionFilePreview>(fetchImpl, baseUrl, `/api/trash/sessions/${encodeURIComponent(trashId)}/files/${index}/preview`),
    restoreTrashSession: (trashId: string) => request<RestoreTrashSessionResponse>(fetchImpl, baseUrl, `/api/trash/sessions/${encodeURIComponent(trashId)}/restore`, {
      method: 'POST',
    }),
    deleteTrashSession: (trashId: string) => request<void>(fetchImpl, baseUrl, `/api/trash/sessions/${encodeURIComponent(trashId)}`, {
      method: 'DELETE',
    }),
    clearTrashSessions: (tool?: AiTool) => request<ClearTrashSessionsResponse>(fetchImpl, baseUrl, `/api/trash/sessions${tool ? `?tool=${tool}` : ''}`, {
      method: 'DELETE',
    }),
    logs: (tool?: AiTool) => request<LogEntry[]>(fetchImpl, baseUrl, `/api/logs${tool ? `?tool=${tool}` : ''}`),
  };
}

/**
 * Default client for browser-side usage.
 */
export const api = createAiManageClient();

async function request<T>(
  fetchImpl: typeof fetch,
  baseUrl: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetchImpl(`${baseUrl}${url}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

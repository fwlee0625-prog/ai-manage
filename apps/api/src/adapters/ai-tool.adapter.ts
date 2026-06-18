import type { AiTool, ConfigFileDetail, ConfigFileSummary, DeleteSessionResponse, LogEntry, SessionDetail, SessionMessage, SessionSummary } from '@ai-manage/shared';

export interface AiToolAdapter {
  readonly tool: AiTool;
  readonly rootPath: string;
  isAvailable(): boolean;
  listConfigFiles(): Promise<ConfigFileSummary[]>;
  getConfigFile(id: string): Promise<ConfigFileDetail | undefined>;
  scanSessions(): Promise<SessionSummary[]>;
  readSession(summary: SessionSummary): Promise<SessionDetail>;
  deleteSession(summary: SessionSummary): Promise<DeleteSessionResponse>;
  readLogs(limit: number): Promise<LogEntry[]>;
}

export function normalizeRole(value: unknown): string {
  const role = typeof value === 'string' ? value : '';
  if (['user', 'assistant', 'system', 'tool'].includes(role)) return role;
  return role || 'event';
}

export function messageFromRaw(id: string, raw: unknown, fallbackTimestamp?: string): SessionMessage {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const message = record.message && typeof record.message === 'object' ? (record.message as Record<string, unknown>) : undefined;
  const content = message?.content ?? record.content ?? record.text ?? record.display ?? record.raw ?? '';
  return {
    id,
    role: normalizeRole(message?.role ?? record.role ?? record.type),
    content: contentToText(content),
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : fallbackTimestamp,
    raw,
  };
}

export function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(item => contentToText(item)).filter(Boolean).join('\n');
  }
  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
  }
  return content === undefined || content === null ? '' : JSON.stringify(content, null, 2);
}

import type { SessionMessage } from '@ai-manage/shared';
import type { ChatMessageRole, ChatMessageViewModel } from './types';

export const chatMessageRoles: ChatMessageRole[] = ['user', 'assistant', 'system', 'tool', 'event', 'unknown'];

export const defaultVisibleChatRoles: ChatMessageRole[] = ['user', 'assistant'];

export const chatRoleLabels: Record<ChatMessageRole, string> = {
  user: '用户',
  assistant: '助手',
  system: '系统',
  tool: '工具',
  event: '事件',
  unknown: '未知',
};

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | undefined {
  return value && typeof value === 'object' ? value as RawRecord : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function payloadFromRaw(raw: unknown): RawRecord | undefined {
  return asRecord(asRecord(raw)?.payload);
}

export function normalizeChatRole(role: string): ChatMessageRole {
  const normalized = role.toLowerCase();
  if (normalized.includes('user') || normalized.includes('human')) return 'user';
  if (normalized.includes('assistant') || normalized.includes('model') || normalized.includes('ai')) return 'assistant';
  if (normalized.includes('system')) return 'system';
  if (normalized.includes('tool') || normalized.includes('function') || normalized.includes('call')) return 'tool';
  if (normalized.includes('event') || normalized.includes('log') || normalized.includes('meta')) return 'event';
  return 'unknown';
}

function normalizeRoleFromMessage(message: SessionMessage): ChatMessageRole {
  const rawRole = roleFromRaw(message.raw);
  return rawRole || normalizeChatRole(message.role);
}

function roleFromRaw(raw: unknown): ChatMessageRole | undefined {
  const record = asRecord(raw);
  const payload = payloadFromRaw(raw);
  const recordType = stringValue(record?.type);
  const payloadType = stringValue(payload?.type);

  if (payloadType === 'message') return normalizeChatRole(stringValue(payload?.role));
  if (payloadType === 'agent_message') return 'assistant';
  if (payloadType === 'user_message') return 'user';
  if (payloadType.includes('function_call') || payloadType.includes('tool_call') || payloadType.includes('custom_tool_call')) {
    return 'tool';
  }
  if (payloadType.includes('call_output') || payloadType.includes('tool_result')) return 'tool';
  if (recordType === 'session_meta') return 'system';
  if (recordType === 'event_msg') return 'event';
  if (recordType === 'response_item') return 'event';
  return undefined;
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(contentToText).filter(Boolean).join('\n');
  const record = asRecord(content);
  if (!record) return content === undefined || content === null ? '' : String(content);
  return stringValue(record.text) || stringValue(record.content) || stringValue(record.message);
}

function formatToolCall(payload: RawRecord): string {
  const name = stringValue(payload.name);
  const args = stringValue(payload.arguments) || stringValue(payload.input);
  return [name ? `调用：${name}` : '', args].filter(Boolean).join('\n');
}

function contentFromRaw(raw: unknown): string {
  const record = asRecord(raw);
  const payload = payloadFromRaw(raw);
  const message = asRecord(record?.message);
  const payloadType = stringValue(payload?.type);

  if (message) return contentToText(message.content);
  if (!payload) return contentToText(record?.content ?? record?.text ?? record?.display);
  if (payloadType === 'message') return contentToText(payload.content);
  if (payloadType === 'agent_message' || payloadType === 'user_message') return stringValue(payload.message);
  if (payloadType.includes('function_call') || payloadType.includes('custom_tool_call')) return formatToolCall(payload);
  if (payloadType.includes('call_output') || payloadType.includes('tool_result')) return stringValue(payload.output);
  if (payloadType === 'task_complete') return stringValue(payload.last_agent_message);
  if (payloadType === 'patch_apply_end') {
    return [stringValue(payload.stdout), stringValue(payload.stderr)].filter(Boolean).join('\n');
  }
  return contentToText(payload.content ?? payload.message ?? payload.text ?? payload.output);
}

export function rawToText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

export function toChatMessageViewModel(message: SessionMessage): ChatMessageViewModel {
  const rawText = rawToText(message.raw);
  const content = message.content || contentFromRaw(message.raw);
  return {
    id: message.id,
    role: normalizeRoleFromMessage(message),
    originalRole: message.role,
    content,
    rawText,
    timestamp: message.timestamp,
    raw: message.raw,
  };
}

export function formatChatTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

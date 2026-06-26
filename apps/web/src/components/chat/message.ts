import type { SessionMessage } from '@ai-manage/shared';
import type { ChatMessageImage, ChatMessageRole, ChatMessageViewModel } from './types';

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

const mirrorEventTimeWindowMs = 2000;

function asRecord(value: unknown): RawRecord | undefined {
  return value && typeof value === 'object' ? value as RawRecord : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function payloadFromRaw(raw: unknown): RawRecord | undefined {
  return asRecord(asRecord(raw)?.payload);
}

function rawRecordType(raw: unknown): string {
  return stringValue(asRecord(raw)?.type);
}

function rawPayloadType(raw: unknown): string {
  return stringValue(payloadFromRaw(raw)?.type);
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
  if (payloadType === 'task_complete' || payloadType === 'token_count' || payloadType === 'task_started') return '';
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

function safeImageSrc(value: unknown): string {
  if (typeof value !== 'string') return '';
  const src = value.trim();
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(src)) return src;
  if (/^https?:\/\//i.test(src)) return src;
  return '';
}

function imageSrcFromValue(value: unknown): string {
  const direct = safeImageSrc(value);
  if (direct) return direct;
  const record = asRecord(value);
  if (!record) return '';
  return safeImageSrc(record.url)
    || safeImageSrc(record.src)
    || safeImageSrc(record.image_url)
    || safeImageSrc(asRecord(record.image_url)?.url)
    || safeImageSrc(record.path);
}

function collectImageCandidates(value: unknown, output: string[]) {
  if (Array.isArray(value)) {
    value.forEach(item => collectImageCandidates(item, output));
    return;
  }

  const src = imageSrcFromValue(value);
  if (src) output.push(src);

  const record = asRecord(value);
  if (!record) return;
  if (record.type === 'input_image') output.push(imageSrcFromValue(record.image_url));
  collectImageCandidates(record.images, output);
  collectImageCandidates(record.local_images, output);
}

/**
 * Extracts browser-renderable images embedded in Codex/Claude raw message records.
 */
function imagesFromRaw(raw: unknown): ChatMessageImage[] {
  const record = asRecord(raw);
  const payload = payloadFromRaw(raw);
  const message = asRecord(record?.message);
  const candidates: string[] = [];

  collectImageCandidates(message?.content, candidates);
  collectImageCandidates(record?.content, candidates);
  collectImageCandidates(record?.images, candidates);
  collectImageCandidates(record?.local_images, candidates);
  collectImageCandidates(payload?.content, candidates);
  collectImageCandidates(payload?.images, candidates);
  collectImageCandidates(payload?.local_images, candidates);

  const seen = new Set<string>();
  return candidates
    .filter(Boolean)
    .filter((src) => {
      if (seen.has(src)) return false;
      seen.add(src);
      return true;
    })
    .map((src, index) => ({
      src,
      alt: `会话图片 ${index + 1}`,
    }));
}

function removeRenderedImageText(value: string, hasRenderedImages: boolean): string {
  if (!hasRenderedImages) return value;
  return value
    .replace(/^\s*#{0,6}\s*Files mentioned by the user:\s*[\s\S]*?\n\s*#{0,6}\s*My request for Codex:\s*/i, '')
    .replace(/<image\b[^>]*>\s*<\/image>/gi, '')
    .replace(/<image\b[^>]*\/>/gi, '')
    .replace(/^\s*<image>\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Returns true for runtime UI events that can mirror response item messages.
 */
function isMirrorEvent(raw: unknown): boolean {
  const payloadType = rawPayloadType(raw);
  return rawRecordType(raw) === 'event_msg'
    && (payloadType === 'user_message' || payloadType === 'agent_message' || payloadType === 'task_complete');
}

function isModelMessageItem(raw: unknown): boolean {
  const payload = payloadFromRaw(raw);
  return rawRecordType(raw) === 'response_item'
    && rawPayloadType(raw) === 'message'
    && ['user', 'assistant'].includes(normalizeChatRole(stringValue(payload?.role)));
}

function mirrorComparableText(value: string): string {
  return removeRenderedImageText(value, true)
    .replace(/\s+/g, ' ')
    .trim();
}

function mirrorDedupeKey(message: ChatMessageViewModel): string {
  return `${message.role}:${mirrorComparableText(message.content)}`;
}

function timestampMs(value?: string): number | undefined {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : time;
}

function hasNearbyModelMessage(
  message: ChatMessageViewModel,
  modelMessageTimesByKey: Map<string, number[]>,
): boolean {
  const currentTime = timestampMs(message.timestamp);
  if (currentTime === undefined) return false;
  const modelTimes = modelMessageTimesByKey.get(mirrorDedupeKey(message));
  return !!modelTimes?.some(time => Math.abs(time - currentTime) <= mirrorEventTimeWindowMs);
}

export function toChatMessageViewModel(message: SessionMessage): ChatMessageViewModel {
  const rawText = rawToText(message.raw);
  const images = imagesFromRaw(message.raw);
  const content = removeRenderedImageText(message.content || contentFromRaw(message.raw), images.length > 0);
  const payloadType = rawPayloadType(message.raw);
  return {
    id: message.id,
    role: normalizeRoleFromMessage(message),
    originalRole: message.role,
    content,
    rawText,
    images,
    mirrorEvent: isMirrorEvent(message.raw),
    hiddenInChat: !content.trim() && images.length === 0
      || payloadType === 'token_count'
      || payloadType === 'task_started'
      || rawRecordType(message.raw) === 'turn_context',
    timestamp: message.timestamp,
    raw: message.raw,
  };
}

/**
 * Hides Codex runtime mirror events when the same response item exists nearby.
 */
export function filterMirrorEvents(messages: ChatMessageViewModel[]): ChatMessageViewModel[] {
  const modelMessageTimesByKey = new Map<string, number[]>();

  messages.forEach((message) => {
    if (!isModelMessageItem(message.raw)) return;
    const time = timestampMs(message.timestamp);
    if (time === undefined) return;
    const key = mirrorDedupeKey(message);
    const times = modelMessageTimesByKey.get(key) || [];
    times.push(time);
    modelMessageTimesByKey.set(key, times);
  });

  return messages.filter(message =>
    !message.hiddenInChat
    && (!message.mirrorEvent || !hasNearbyModelMessage(message, modelMessageTimesByKey)),
  );
}

export function formatChatTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

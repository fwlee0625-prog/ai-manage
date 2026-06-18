export type ChatDisplayMode = 'chat' | 'raw';

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'event' | 'unknown';

export interface ChatMessageViewModel {
  id: string;
  role: ChatMessageRole;
  originalRole: string;
  content: string;
  rawText: string;
  timestamp?: string;
  raw: unknown;
}

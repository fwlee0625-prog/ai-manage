export type ChatDisplayMode = 'chat' | 'raw';

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'event' | 'unknown';

export interface ChatMessageImage {
  src: string;
  alt: string;
}

export interface ChatMessageViewModel {
  id: string;
  role: ChatMessageRole;
  originalRole: string;
  content: string;
  rawText: string;
  images: ChatMessageImage[];
  mirrorEvent: boolean;
  hiddenInChat?: boolean;
  live?: {
    type: 'status';
    state: 'processed' | 'thinking' | 'working' | 'running' | 'reading' | 'editing' | 'searching' | 'executing';
    detail?: string;
  };
  timestamp?: string;
  raw: unknown;
}

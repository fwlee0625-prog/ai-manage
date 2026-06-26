import type { ChatMessageViewModel } from '../../components/chat/types';

interface RuntimeStatus {
  state: 'processed' | 'thinking' | 'working' | 'running' | 'reading' | 'editing' | 'searching' | 'executing';
  text: string;
  detail?: string;
}

interface LiveTerminalOptions {
  elapsedSeconds?: number;
  waitingForFirstOutput?: boolean;
}

/**
 * Converts the live PTY stream into conversation-area runtime messages.
 */
export function liveTerminalMessagesFromOutput(
  terminalSessionId: string,
  output: string,
  options: LiveTerminalOptions = {},
): ChatMessageViewModel[] {
  return extractRuntimeStatuses(output, options).map((status, index) =>
    toLiveMessage(terminalSessionId, status, index),
  );
}

function toLiveMessage(
  terminalSessionId: string,
  status: RuntimeStatus,
  index: number,
): ChatMessageViewModel {
  return {
    id: `live-status-${terminalSessionId}-${status.state}-${index}`,
    role: 'event',
    originalRole: 'live-status',
    content: status.text,
    rawText: status.text,
    images: [],
    mirrorEvent: false,
    live: {
      type: 'status',
      state: status.state,
      detail: status.detail,
    },
    raw: { type: 'live_status', terminalSessionId, status },
  };
}

function extractRuntimeStatuses(output: string, options: LiveTerminalOptions): RuntimeStatus[] {
  const lines = terminalTextLines(output);
  const elapsed = options.elapsedSeconds === undefined
    ? undefined
    : { state: 'processed', text: '已处理', detail: formatElapsed(options.elapsedSeconds) } satisfies RuntimeStatus;
  const activity = extractActivityStatus(lines);
  const statuses = [elapsed, activity].filter(Boolean) as RuntimeStatus[];
  if (statuses.length) return statuses;
  if (options.waitingForFirstOutput || lines.some(line => /\bThinking\b|正在思考/i.test(line))) {
    return [{ state: 'thinking', text: '正在思考' }];
  }
  return [];
}

function extractActivityStatus(lines: string[]): RuntimeStatus | undefined {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const parsed = parseActivityLine(lines[index]);
    if (parsed) return parsed;
  }
  return undefined;
}

function parseActivityLine(line: string): RuntimeStatus | undefined {
  const normalized = cleanStatusLine(line);
  if (!normalized || /\bWorking\s*\(/i.test(normalized)) return undefined;

  const localized = normalized.match(/^(正在读取|正在编辑|正在搜索|正在执行)\s+(.+)$/);
  if (localized) return localizedStatus(localized[1], localized[2]);

  const reading = normalized.match(/\b(?:Reading|Read|Opening)\s+(.+)$/i)
    || normalized.match(/\b(?:cat|sed|tail|head|less)\b\s+(?:-[^\s]+\s+)*(?:'[^']+'\s+|\"[^\"]+\"\s+)?(.+)$/i);
  if (reading) return { state: 'reading', text: '正在读取', detail: fileLabel(reading[1]) };

  const searching = normalized.match(/\b(?:Searching|Search|rg|grep)\b\s+(.+)$/i);
  if (searching) return { state: 'searching', text: '正在搜索', detail: compactDetail(searching[1]) };

  const editing = normalized.match(/\b(?:Writing|Editing|Patching|apply_patch)\b\s+(.+)$/i);
  if (editing) return { state: 'editing', text: '正在编辑', detail: fileLabel(editing[1]) };

  const executing = normalized.match(/\b(?:Running|Executing|exec_command|pnpm|npm|node|git)\b\s+(.+)$/i);
  if (executing) return { state: 'executing', text: '正在执行', detail: compactDetail(executing[1]) };

  return undefined;
}

function localizedStatus(action: string, detail: string): RuntimeStatus {
  const stateByAction: Record<string, RuntimeStatus['state']> = {
    正在读取: 'reading',
    正在编辑: 'editing',
    正在搜索: 'searching',
    正在执行: 'executing',
  };
  return {
    state: stateByAction[action] || 'running',
    text: action,
    detail: fileLabel(detail),
  };
}

function terminalTextLines(output: string) {
  return stripAnsi(latestTerminalFrame(output))
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => cleanStatusLine(line))
    .filter(Boolean)
    .slice(-80);
}

function latestTerminalFrame(output: string) {
  const frames = output.split(/\x1B\[[0-?]*[ -/]*J/g);
  return frames.at(-1) || output.slice(-8000);
}

function stripAnsi(value: string) {
  return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1B\\))/g, '');
}

function cleanStatusLine(value: string) {
  return value
    .replace(/[│┃╭╮╰╯─━┌┐└┘├┤┬┴┼]/g, ' ')
    .replace(/^[>\s•·*.-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fileLabel(value: string) {
  const detail = compactDetail(value)
    .replace(/^['"]|['"]$/g, '')
    .split(/\s+/)
    .find(part => /[./\\]/.test(part) || /\.[a-z0-9]+$/i.test(part))
    || compactDetail(value);
  return detail.split(/[\\/]/).filter(Boolean).at(-1) || detail;
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function compactDetail(value: string) {
  return value
    .replace(/[{}[\],]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

import type { SessionUsage } from '@ai-manage/shared';

/**
 * 会话用量收集器的统一形态：逐行喂入原始 jsonl 行，最后产出 {@link SessionUsage}。
 *
 * 收集器是无状态的纯逻辑对象，不依赖文件系统与 UI，便于单测和跨工具复用。
 */
export interface SessionUsageCollector {
  /** 喂入一行原始会话记录，内部按行类型分派统计。 */
  add(row: Record<string, unknown>): void;
  /** 汇总当前累计的用量统计。 */
  usage(): SessionUsage;
}

const CODEX_TOOL_PAYLOAD_TYPES = new Set(['function_call', 'custom_tool_call']);

/**
 * 会话内模型收集器：按首次出现顺序去重记录使用过的模型，并保留「最后使用」语义。
 */
function createModelTracker() {
  let last: string | undefined;
  const seen: string[] = [];
  return {
    /** 记录一次模型出现；去重并更新「最后使用」。 */
    see(next: string) {
      last = next;
      if (!seen.includes(next)) seen.push(next);
    },
    /** 组装 SessionUsage 的模型字段（未出现模型时不产生字段）。 */
    fields(): { model?: string; models?: string[] } {
      return {
        ...(last ? { model: last } : {}),
        ...(seen.length ? { models: [...seen] } : {}),
      };
    },
  };
}

/**
 * 创建 Codex 会话用量收集器。
 *
 * 口径说明（基于 rollout jsonl 的实测结构）：
 * - `event_msg` + `payload.type === 'token_count'` 的 `payload.info.total_token_usage`
 *   是会话累计快照（事件会重复出现且 `info` 可能为 null），因此采用「最后一个非 null 快照覆盖」策略，
 *   不能逐事件求和。
 * - 工具调用按 `response_item` 行的 `payload.type`（`function_call` / `custom_tool_call`）计数，
 *   并按 `payload.name` 分组。
 * - 模型取最后一个 `turn_context` 行的 `payload.model`；`models` 为会话中去重后的全部模型。
 */
export function createCodexUsageCollector(): SessionUsageCollector {
  let snapshot: Record<string, unknown> | undefined;
  const toolCallBreakdown: Record<string, number> = {};
  const modelTracker = createModelTracker();

  return {
    add(row) {
      const type = typeof row.type === 'string' ? row.type : '';
      const payload = asRecord(row.payload);
      const payloadType = typeof payload?.type === 'string' ? payload.type : '';
      if (type === 'event_msg' && payloadType === 'token_count') {
        const info = asRecord(payload?.info);
        const total = asRecord(info?.total_token_usage);
        if (total) snapshot = total;
        return;
      }
      if (type === 'response_item' && CODEX_TOOL_PAYLOAD_TYPES.has(payloadType)) {
        const name = normalizeToolName(payload?.name);
        toolCallBreakdown[name] = (toolCallBreakdown[name] || 0) + 1;
        return;
      }
      if (type === 'turn_context' && typeof payload?.model === 'string' && payload.model.trim()) {
        modelTracker.see(payload.model.trim());
      }
    },
    usage() {
      return {
        inputTokens: toCount(snapshot?.input_tokens),
        cacheReadTokens: toCount(snapshot?.cached_input_tokens),
        cacheWriteTokens: toCount(snapshot?.cache_write_input_tokens),
        outputTokens: toCount(snapshot?.output_tokens),
        totalTokens: toCount(snapshot?.total_tokens),
        toolCallCount: sumBreakdown(toolCallBreakdown),
        toolCallBreakdown: { ...toolCallBreakdown },
        ...modelTracker.fields(),
      };
    },
  };
}

/**
 * 创建 Claude 会话用量收集器。
 *
 * 口径说明（基于 `~/.claude/projects` 目录下各会话 jsonl 的实测结构）：
 * - 每条 `assistant` 行的 `message.usage` 是单次 API 调用的用量（无累计字段），
 *   需逐行求和；`input_tokens` 不含缓存，缓存读/写单列。求和口径表示「处理过的总 Token 量」。
 * - 工具调用按 `message.content` 中 `type === 'tool_use'` 内容块计数，并按 `name` 分组；
 *   `isSidechain` 子代理流量一并计入。
 * - 模型取最后一条携带 `message.model` 的记录；`models` 为会话中去重后的全部模型。
 */
export function createClaudeUsageCollector(): SessionUsageCollector {
  let inputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let outputTokens = 0;
  const toolCallBreakdown: Record<string, number> = {};
  const modelTracker = createModelTracker();

  return {
    add(row) {
      const message = asRecord(row.message);
      if (!message) return;
      const role = typeof message.role === 'string' ? message.role : '';
      if (role && role !== 'assistant' && row.type !== 'assistant') return;

      const usage = asRecord(message.usage);
      if (usage) {
        inputTokens += toCount(usage.input_tokens);
        cacheReadTokens += toCount(usage.cache_read_input_tokens);
        cacheWriteTokens += toCount(usage.cache_creation_input_tokens);
        outputTokens += toCount(usage.output_tokens);
      }
      if (typeof message.model === 'string' && message.model.trim()) {
        modelTracker.see(message.model.trim());
      }
      const content = message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          const blockRecord = asRecord(block);
          if (blockRecord?.type !== 'tool_use') continue;
          const name = normalizeToolName(blockRecord.name);
          toolCallBreakdown[name] = (toolCallBreakdown[name] || 0) + 1;
        }
      }
    },
    usage() {
      return {
        inputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        outputTokens,
        totalTokens: inputTokens + cacheReadTokens + cacheWriteTokens + outputTokens,
        toolCallCount: sumBreakdown(toolCallBreakdown),
        toolCallBreakdown: { ...toolCallBreakdown },
        ...modelTracker.fields(),
      };
    },
  };
}

/** Narrows an unknown value into a plain object record. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

/** Coerces a raw numeric-ish field into a non-negative integer count. */
function toCount(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

/** Falls back to `unknown` when a tool call is missing its name. */
function normalizeToolName(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'unknown';
}

/** Sums all per-tool counters into the total call count. */
function sumBreakdown(breakdown: Record<string, number>): number {
  return Object.values(breakdown).reduce((total, count) => total + count, 0);
}

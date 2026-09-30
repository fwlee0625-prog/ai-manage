import type { AiTool } from './common.js';

/**
 * 用量统计的通用数值汇总（跨端共享，纯数据结构）。
 *
 * 统计口径：
 * - inputTokens：Claude 的 `input_tokens`（不含缓存）；Codex 的 `input_tokens`（含缓存命中部分）。
 * - cacheReadTokens：缓存命中读取的 Token（Claude `cache_read_input_tokens`；Codex `cached_input_tokens`）。
 * - cacheWriteTokens：缓存写入的 Token（Claude `cache_creation_input_tokens`；Codex `cache_write_input_tokens`）。
 * - outputTokens：模型输出 Token（含推理输出）。
 * - totalTokens：Codex 取官方累计值 `total_tokens`；Claude 为四项之和。
 * - toolCallCount：会话内工具调用总次数（Codex `function_call`/`custom_tool_call`；Claude `tool_use` 内容块）。
 */
export interface UsageTotals {
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolCallCount: number;
}

/**
 * 单个会话的用量统计：数值汇总 + 工具调用按工具名分布 + 会话使用的模型。
 */
export interface SessionUsage extends UsageTotals {
  /** 工具名 → 调用次数，例如 `{ Read: 28, Bash: 20 }`。 */
  toolCallBreakdown: Record<string, number>;
  /** 会话使用的模型（Codex 取最后一个 turn_context；Claude 取最后一条 assistant 消息）。 */
  model?: string;
  /** 会话中实际使用过的模型去重列表（按首次出现顺序）；旧索引数据可能缺失。 */
  models?: string[];
}

/**
 * 单个项目的用量统计聚合，按 `SUM(total_tokens)` 降序返回。
 */
export interface ProjectUsageStats {
  tool: AiTool;
  projectPath: string;
  projectName: string;
  sessionCount: number;
  latestUpdatedAt?: string;
  usage: UsageTotals;
  /** 工具名 → 调用次数（项目内所有会话合并）。 */
  toolCallBreakdown: Record<string, number>;
}

/**
 * 全局用量总览：归约自项目级统计，无需额外 SQL。
 */
export interface UsageOverview {
  tool?: AiTool;
  projectCount: number;
  sessionCount: number;
  totals: UsageTotals;
  /** 工具名 → 调用次数（所有项目合并）。 */
  toolCallBreakdown: Record<string, number>;
  latestUpdatedAt?: string;
}

/**
 * 单日用量数据点；会话用量按其 `updated_at` 归入当天（索引无逐轮时间戳，属已知简化）。
 */
export interface DailyUsagePoint extends UsageTotals {
  /** 日期，格式 `YYYY-MM-DD`，升序排列。 */
  date: string;
  /** 当天有动态的会话数。 */
  sessionCount: number;
}

/**
 * 按日用量统计查询参数。
 */
export interface DailyUsageQuery {
  tool?: AiTool;
  projectPath?: string;
  /** 统计最近 N 天，默认 30，夹取 1~180。 */
  days?: number;
}

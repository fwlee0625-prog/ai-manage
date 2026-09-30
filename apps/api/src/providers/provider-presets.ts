import type { AiTool, ProviderPreset } from '@ai-manage/shared';

/**
 * Built-in provider presets. Endpoints follow each vendor's official tooling docs:
 * Codex uses the OpenAI-compatible base url (`responses` wire api) and Claude uses the
 * vendor's Anthropic-compatible base url.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'openai-official', tool: 'codex', name: 'OpenAI Official', providerType: 'openai', endpoint: 'https://api.openai.com/v1', apiProtocol: 'responses', authMode: 'native_login', icon: 'openai', metadata: { official: true } },
  { id: 'openrouter', tool: 'codex', name: 'OpenRouter', providerType: 'openrouter', endpoint: 'https://openrouter.ai/api/v1', apiProtocol: 'responses', authMode: 'api_key', icon: 'openrouter', metadata: {} },
  { id: 'deepseek', tool: 'codex', name: 'DeepSeek', providerType: 'deepseek', endpoint: 'https://api.deepseek.com', apiProtocol: 'responses', authMode: 'api_key', icon: 'deepseek', metadata: {} },
  { id: 'zhipu', tool: 'codex', name: '智谱 GLM', providerType: 'zhipu', endpoint: 'https://open.bigmodel.cn/api/paas/v4', apiProtocol: 'responses', authMode: 'api_key', icon: 'zhipu', metadata: {} },
  { id: 'kimi', tool: 'codex', name: 'Kimi', providerType: 'kimi', endpoint: 'https://api.moonshot.cn/v1', apiProtocol: 'responses', authMode: 'api_key', icon: 'kimi', metadata: {} },
  { id: 'minimax', tool: 'codex', name: 'MiniMax', providerType: 'minimax', endpoint: 'https://api.minimax.cn/v1', apiProtocol: 'responses', authMode: 'api_key', icon: 'minimax', metadata: {} },
  { id: 'custom-openai-compatible', tool: 'codex', name: 'OpenAI Compatible', providerType: 'openai-compatible', apiProtocol: 'responses', authMode: 'api_key', metadata: { custom: true } },
  { id: 'claude-official', tool: 'claude', name: 'Claude Official', providerType: 'anthropic', endpoint: 'https://api.anthropic.com', apiProtocol: 'anthropic', authMode: 'native_login', icon: 'anthropic', metadata: { official: true } },
  { id: 'openrouter', tool: 'claude', name: 'OpenRouter', providerType: 'openrouter', endpoint: 'https://openrouter.ai/api/v1', apiProtocol: 'anthropic', authMode: 'api_key', icon: 'openrouter', metadata: {} },
  { id: 'deepseek', tool: 'claude', name: 'DeepSeek', providerType: 'deepseek', endpoint: 'https://api.deepseek.com', apiProtocol: 'anthropic', authMode: 'api_key', icon: 'deepseek', metadata: {} },
  { id: 'zhipu', tool: 'claude', name: '智谱 GLM', providerType: 'zhipu', endpoint: 'https://open.bigmodel.cn/api/anthropic', apiProtocol: 'anthropic', authMode: 'api_key', icon: 'zhipu', metadata: {} },
  { id: 'kimi', tool: 'claude', name: 'Kimi', providerType: 'kimi', endpoint: 'https://api.moonshot.cn/anthropic', apiProtocol: 'anthropic', authMode: 'api_key', icon: 'kimi', metadata: {} },
  { id: 'minimax', tool: 'claude', name: 'MiniMax', providerType: 'minimax', endpoint: 'https://api.minimax.cn/anthropic', apiProtocol: 'anthropic', authMode: 'api_key', icon: 'minimax', metadata: {} },
  { id: 'custom-anthropic-compatible', tool: 'claude', name: 'Anthropic Compatible', providerType: 'anthropic-compatible', apiProtocol: 'anthropic', authMode: 'api_key', metadata: { custom: true } },
];

/** Returns provider presets for one tool. */
export function providerPresets(tool: AiTool): ProviderPreset[] {
  return PROVIDER_PRESETS.filter(item => item.tool === tool).map(item => ({ ...item, metadata: { ...item.metadata } }));
}

/** Resolves one preset within a tool. */
export function findProviderPreset(tool: AiTool, id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find(item => item.tool === tool && item.id === id);
}

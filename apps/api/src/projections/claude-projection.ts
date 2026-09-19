import { BadRequestException } from '@nestjs/common';
import { cloneRecord, type ProjectionInput, type ProjectionResult } from './projection.types.js';

const OWNED_ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_MODEL',
] as const;

/** Projects one managed provider into Claude env fields while preserving unrelated settings. */
export function buildClaudeProjection(input: ProjectionInput): ProjectionResult {
  const config = cloneRecord(input.currentConfig);
  const env = isRecord(config.env) ? cloneRecord(config.env) : {};
  for (const key of OWNED_ENV_KEYS) delete env[key];

  if (input.provider.authMode === 'api_key') {
    if (!input.credential) throw new BadRequestException('Provider API key credential is not configured');
    env.ANTHROPIC_API_KEY = input.credential;
  }
  if (input.provider.endpoint && input.provider.authMode !== 'native_login') {
    env.ANTHROPIC_BASE_URL = input.provider.endpoint;
  }
  if (input.provider.defaultModel) env.ANTHROPIC_MODEL = input.provider.defaultModel;

  config.env = env;
  return { config, authTouched: false, warnings: [] };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

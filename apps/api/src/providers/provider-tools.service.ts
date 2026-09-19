import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AiProviderProfile,
  CreateProviderRequest,
  ProviderModelsResponse,
  ProviderTestResponse,
} from '@ai-manage/shared';
import { CredentialStoreService } from '../credentials/credential-store.service.js';
import { ProvidersRepository } from './providers.repository.js';

@Injectable()
export class ProviderToolsService {
  constructor(
    private readonly providers: ProvidersRepository,
    private readonly credentials: CredentialStoreService,
  ) {}

  /** Tests a saved provider without returning upstream response bodies or secret material. */
  async testProvider(id: string): Promise<ProviderTestResponse> {
    const provider = await this.requireProvider(id);
    try {
      const response = await this.fetchModels(provider, await this.credentialFor(provider));
      return response.ok
        ? { ok: true, stage: 'connect', status: response.status, message: '连接与认证检查通过' }
        : { ok: false, stage: 'connect', status: response.status, message: `上游返回 HTTP ${response.status}` };
    } catch (error) {
      return { ok: false, stage: 'connect', message: safeError(error) };
    }
  }

  /** Fetches model ids for a saved provider. */
  async modelsForProvider(id: string): Promise<ProviderModelsResponse> {
    const provider = await this.requireProvider(id);
    return { models: await this.readModelIds(await this.fetchModels(provider, await this.credentialFor(provider))) };
  }

  /** Fetches model ids from an unsaved provider draft so creation does not require a prior save. */
  async modelsForDraft(body: CreateProviderRequest): Promise<ProviderModelsResponse> {
    if (!body.tool || !body.endpoint) throw new BadRequestException('tool and endpoint are required');
    const now = new Date().toISOString();
    const provider: AiProviderProfile = {
      id: 'draft',
      tool: body.tool,
      name: body.name || 'Draft',
      providerType: body.providerType || 'custom',
      endpoint: body.endpoint,
      apiProtocol: body.apiProtocol,
      defaultModel: body.defaultModel,
      reasoningEffort: body.reasoningEffort,
      authMode: body.authMode || (body.apiKey ? 'api_key' : 'none'),
      metadata: body.metadata || {},
      createdAt: now,
      updatedAt: now,
    };
    return { models: await this.readModelIds(await this.fetchModels(provider, body.apiKey?.trim())) };
  }

  private async requireProvider(id: string): Promise<AiProviderProfile> {
    const provider = await this.providers.get(id);
    if (!provider) throw new BadRequestException('Provider not found');
    return provider;
  }

  private async credentialFor(provider: AiProviderProfile): Promise<string | undefined> {
    if (!provider.credentialId || !await this.credentials.hasCredential(provider.credentialId)) return undefined;
    return this.credentials.readApiKey(provider.credentialId);
  }

  private async fetchModels(provider: AiProviderProfile, credential?: string): Promise<Response> {
    if (!provider.endpoint) throw new BadRequestException('Provider endpoint is required');
    const base = new URL(provider.endpoint);
    if (!['http:', 'https:'].includes(base.protocol)) throw new BadRequestException('Only http/https endpoints are supported');
    const url = new URL(base.toString().replace(/\/$/, '') + '/models');
    const headers: Record<string, string> = { accept: 'application/json' };
    if (credential) {
      if (provider.tool === 'claude') {
        headers['x-api-key'] = credential;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers.authorization = `Bearer ${credential}`;
      }
    }
    return fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  }

  private async readModelIds(response: Response): Promise<string[]> {
    if (!response.ok) throw new Error(`Model request failed with HTTP ${response.status}`);
    const json = await response.json() as unknown;
    if (!json || typeof json !== 'object') return [];
    const data = (json as { data?: unknown }).data;
    if (!Array.isArray(data)) return [];
    return data
      .map(item => item && typeof item === 'object' && 'id' in item ? String((item as { id: unknown }).id) : '')
      .filter(Boolean)
      .sort();
  }
}

function safeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') return '连接超时';
  if (error instanceof Error) {
    if (error.message.includes('HTTP')) return error.message;
    return '连接失败';
  }
  return '连接失败';
}

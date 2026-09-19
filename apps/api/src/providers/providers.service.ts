import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AiProviderProfile, AiTool, CreateProviderRequest, ProviderPreset, UpdateProviderRequest } from '@ai-manage/shared';
import { randomUUID } from 'node:crypto';
import { CredentialStoreService } from '../credentials/credential-store.service.js';
import { findProviderPreset, providerPresets } from './provider-presets.js';
import { ProvidersRepository } from './providers.repository.js';

@Injectable()
export class ProvidersService {
  constructor(private readonly repository: ProvidersRepository, private readonly credentials: CredentialStoreService) {}

  /** Lists managed providers without secret values. */
  async list(tool?: AiTool): Promise<AiProviderProfile[]> {
    return Promise.all((await this.repository.list(tool)).map(item => this.withCredential(item)));
  }

  /** Reads one managed provider. */
  async get(id: string): Promise<AiProviderProfile> {
    const provider = await this.repository.get(id);
    if (!provider) throw new NotFoundException('Provider not found');
    return this.withCredential(provider);
  }

  /** Lists presets for one tool. */
  presets(tool: AiTool): ProviderPreset[] { return providerPresets(tool); }

  /** Creates a provider from a preset or explicit fields. */
  async create(body: CreateProviderRequest): Promise<AiProviderProfile> {
    if (!body.tool) throw new BadRequestException('tool is required');
    const preset = body.presetId ? findProviderPreset(body.tool, body.presetId) : undefined;
    if (body.presetId && !preset) throw new BadRequestException('Provider preset not found');
    const name = body.name?.trim() || preset?.name;
    const providerType = body.providerType?.trim() || preset?.providerType;
    if (!name || !providerType) throw new BadRequestException('Provider name and providerType are required');
    let credentialId = body.credentialId;
    if (body.apiKey?.trim()) credentialId = (await this.credentials.createApiKey(body.apiKey)).id;
    const now = new Date().toISOString();
    const provider: AiProviderProfile = {
      id: randomUUID(), tool: body.tool, name, providerType,
      endpoint: clean(body.endpoint ?? preset?.endpoint), apiProtocol: clean(body.apiProtocol ?? preset?.apiProtocol),
      defaultModel: clean(body.defaultModel ?? preset?.defaultModel), reasoningEffort: clean(body.reasoningEffort),
      authMode: body.authMode || preset?.authMode || 'none', accountId: clean(body.accountId), credentialId: clean(credentialId),
      metadata: { ...(preset?.metadata || {}), ...(body.metadata || {}) }, createdAt: now, updatedAt: now,
    };
    this.validate(provider);
    await this.repository.save(provider);
    return this.withCredential(provider);
  }

  /** Updates provider fields and optionally replaces/removes credentials. */
  async update(id: string, body: UpdateProviderRequest): Promise<AiProviderProfile> {
    const current = await this.repository.get(id);
    if (!current) throw new NotFoundException('Provider not found');
    let credentialId = body.credentialId === null ? undefined : body.credentialId ?? current.credentialId;
    if (body.removeCredential && credentialId) { await this.credentials.deleteCredential(credentialId); credentialId = undefined; }
    if (body.apiKey?.trim()) {
      if (credentialId && await this.credentials.hasCredential(credentialId)) await this.credentials.replaceApiKey(credentialId, body.apiKey);
      else credentialId = (await this.credentials.createApiKey(body.apiKey)).id;
    }
    const provider: AiProviderProfile = {
      ...current,
      name: body.name?.trim() || current.name,
      providerType: body.providerType?.trim() || current.providerType,
      endpoint: body.endpoint === null ? undefined : clean(body.endpoint) ?? current.endpoint,
      apiProtocol: body.apiProtocol === null ? undefined : clean(body.apiProtocol) ?? current.apiProtocol,
      defaultModel: body.defaultModel === null ? undefined : clean(body.defaultModel) ?? current.defaultModel,
      reasoningEffort: body.reasoningEffort === null ? undefined : clean(body.reasoningEffort) ?? current.reasoningEffort,
      authMode: body.authMode ?? current.authMode,
      accountId: body.accountId === null ? undefined : clean(body.accountId) ?? current.accountId,
      credentialId, metadata: body.metadata ? { ...body.metadata } : current.metadata, updatedAt: new Date().toISOString(),
    };
    this.validate(provider);
    await this.repository.save(provider);
    return this.withCredential(provider);
  }

  /** Deletes a provider and its owned API-key credential. */
  async delete(id: string): Promise<void> {
    const current = await this.repository.get(id);
    if (!current) return;
    await this.repository.delete(id);
    if (current.credentialId) await this.credentials.deleteCredential(current.credentialId);
  }

  /** Duplicates non-secret provider fields without copying credentials. */
  async duplicate(id: string): Promise<AiProviderProfile> {
    const current = await this.repository.get(id);
    if (!current) throw new NotFoundException('Provider not found');
    return this.create({ tool: current.tool, name: `${current.name} 副本`, providerType: current.providerType, endpoint: current.endpoint, apiProtocol: current.apiProtocol, defaultModel: current.defaultModel, reasoningEffort: current.reasoningEffort, authMode: current.authMode, accountId: current.accountId, metadata: { ...current.metadata, duplicatedFrom: current.id } });
  }

  private validate(provider: AiProviderProfile): void {
    if (provider.authMode === 'managed_account' && !provider.accountId) throw new BadRequestException('Managed account provider requires accountId');
    if (provider.authMode !== 'managed_account' && provider.accountId) throw new BadRequestException('accountId is only valid for managed_account auth');
  }

  private async withCredential(provider: AiProviderProfile): Promise<AiProviderProfile> {
    return { ...provider, credential: provider.credentialId ? await this.credentials.summary(provider.credentialId) : undefined };
  }
}
function clean(value?: string): string | undefined { const normalized = value?.trim(); return normalized || undefined; }

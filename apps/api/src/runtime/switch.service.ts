import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AiTool, SwitchProviderRequest, SwitchProviderResponse } from '@ai-manage/shared';
import { CredentialStoreService } from '../credentials/credential-store.service.js';
import { buildClaudeProjection } from '../projections/claude-projection.js';
import { buildCodexProjection } from '../projections/codex-projection.js';
import { ProvidersRepository } from '../providers/providers.repository.js';
import { LiveFileWriterService } from './live-file-writer.service.js';
import { RuntimeDetectorService } from './runtime-detector.service.js';
import { RuntimeRepository } from './runtime.repository.js';
import { SnapshotService } from './snapshot.service.js';

export type SwitchStage =
  | 'acquire_lock' | 'load_provider' | 'load_runtime' | 'snapshot' | 'resolve_auth'
  | 'preflight_auth' | 'project' | 'validate' | 'write_live' | 'verify'
  | 'commit_active' | 'restore';

@Injectable()
export class SwitchService {
  private readonly locks = new Map<AiTool, Promise<void>>();

  constructor(
    private readonly providers: ProvidersRepository,
    private readonly credentials: CredentialStoreService,
    private readonly writer: LiveFileWriterService,
    private readonly snapshots: SnapshotService,
    private readonly detector: RuntimeDetectorService,
    private readonly runtime: RuntimeRepository,
  ) {}

  /** Serializes switches per tool and executes a rollback-safe live projection transaction. */
  async switchProvider(request: SwitchProviderRequest): Promise<SwitchProviderResponse> {
    return this.withToolLock(request.tool, () => this.executeSwitch(request));
  }

  private async executeSwitch(request: SwitchProviderRequest): Promise<SwitchProviderResponse> {
    let stage: SwitchStage = 'load_provider';
    let snapshot: Awaited<ReturnType<SnapshotService['capture']>> | undefined;
    const previous = await this.runtime.active(request.tool);
    try {
      const provider = await this.providers.get(request.providerId);
      if (!provider) throw new NotFoundException('Provider not found');
      if (provider.tool !== request.tool) throw new BadRequestException('Provider belongs to another tool');

      stage = 'load_runtime';
      const live = await this.writer.readLive(request.tool);

      stage = 'snapshot';
      snapshot = await this.snapshots.capture(request.tool);

      stage = 'resolve_auth';
      let credential: string | undefined;
      if (provider.authMode === 'api_key') {
        stage = 'preflight_auth';
        if (!provider.credentialId || !await this.credentials.hasCredential(provider.credentialId)) {
          throw new BadRequestException('Provider API key credential is not configured');
        }
        credential = await this.credentials.readApiKey(provider.credentialId);
      }

      stage = 'project';
      const projection = request.tool === 'codex'
        ? buildCodexProjection({ provider, credential, currentConfig: live.config, currentAuth: live.auth })
        : buildClaudeProjection({ provider, credential, currentConfig: live.config, currentAuth: live.auth });

      stage = 'validate';
      if (!projection.config || typeof projection.config !== 'object') throw new Error('Projection did not produce config');

      stage = 'write_live';
      await this.writer.writeProjection(request.tool, projection);

      stage = 'verify';
      if (!await this.detector.matchesProvider(provider)) throw new Error('Runtime verification failed');

      stage = 'commit_active';
      await this.runtime.setActive(request.tool, provider.id);
      await this.runtime.addHistory({
        tool: request.tool,
        fromProviderId: previous?.providerId,
        toProviderId: provider.id,
        status: 'success',
        rolledBack: false,
      });
      return {
        success: true,
        tool: request.tool,
        providerId: provider.id,
        warnings: projection.warnings,
        runtime: await this.detector.summary(request.tool),
      };
    } catch (error) {
      let rolledBack = false;
      const failedStage = stage;
      if (snapshot) {
        try {
          stage = 'restore';
          await this.snapshots.restore(snapshot);
          rolledBack = true;
        } catch {
          rolledBack = false;
        }
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.runtime.addHistory({
        tool: request.tool,
        fromProviderId: previous?.providerId,
        toProviderId: request.providerId,
        status: 'failed',
        failedStage,
        error: message,
        rolledBack,
      });
      return { success: false, tool: request.tool, providerId: request.providerId, stage: failedStage, rolledBack };
    }
  }

  private async withToolLock<T>(tool: AiTool, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(tool) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => gate);
    this.locks.set(tool, queued);
    await previous;
    try { return await task(); }
    finally {
      release();
      if (this.locks.get(tool) === queued) this.locks.delete(tool);
    }
  }
}

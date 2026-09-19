import { BadRequestException, Injectable } from '@nestjs/common';
import type { AiTool, RuntimeSummary, SwitchProviderResponse } from '@ai-manage/shared';
import { ProviderImportService } from '../providers/provider-import.service.js';
import { RuntimeDetectorService } from './runtime-detector.service.js';
import { RuntimeRepository } from './runtime.repository.js';
import { SwitchService } from './switch.service.js';

@Injectable()
export class RuntimeSyncService {
  constructor(
    private readonly detector: RuntimeDetectorService,
    private readonly runtime: RuntimeRepository,
    private readonly importer: ProviderImportService,
    private readonly switches: SwitchService,
  ) {}

  /** Adopts recognizable live configuration into managed state without changing live files. */
  async adoptLive(tool: AiTool): Promise<RuntimeSummary> {
    let summary = await this.detector.summary(tool);
    if (!summary.actualProviderMatchId) {
      await this.importer.importLive(tool);
      summary = await this.detector.summary(tool);
    }
    if (!summary.actualProviderMatchId) {
      throw new BadRequestException('Current live configuration cannot be matched to a managed Provider');
    }
    await this.runtime.setActive(tool, summary.actualProviderMatchId);
    return this.detector.summary(tool);
  }

  /** Reapplies the currently managed provider through the transactional switch engine. */
  async restoreManaged(tool: AiTool): Promise<SwitchProviderResponse> {
    const active = await this.runtime.active(tool);
    if (!active) throw new BadRequestException('No managed Provider is active for this tool');
    return this.switches.switchProvider({ tool, providerId: active.providerId });
  }
}

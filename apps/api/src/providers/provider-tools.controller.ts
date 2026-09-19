import { Body, Controller, Post } from '@nestjs/common';
import type { ProviderDraftModelsRequest } from '@ai-manage/shared';
import { ProviderToolsService } from './provider-tools.service.js';

@Controller('provider-tools')
export class ProviderToolsController {
  constructor(private readonly tools: ProviderToolsService) {}

  /** Fetches models from an unsaved provider draft. */
  @Post('models')
  models(@Body() body: ProviderDraftModelsRequest) {
    return this.tools.modelsForDraft(body);
  }
}

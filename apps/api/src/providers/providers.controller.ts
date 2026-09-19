import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AiTool, CreateProviderRequest, ImportProvidersRequest, UpdateProviderRequest } from '@ai-manage/shared';
import { ProviderImportService } from './provider-import.service.js';
import { ProvidersService } from './providers.service.js';
import { ProviderToolsService } from './provider-tools.service.js';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService, private readonly importer: ProviderImportService, private readonly tools: ProviderToolsService) {}

  /** Lists managed providers. */
  @Get() list(@Query('tool') tool?: AiTool) { return this.providers.list(tool); }

  /** Lists preset templates. */
  @Get('presets') presets(@Query('tool') tool: AiTool) { return this.providers.presets(tool); }

  /** Imports live provider configuration into managed state. */
  @Post('import-live') importLive(@Body() body: ImportProvidersRequest) { return this.importer.importLive(body.tool); }

  /** Creates a managed provider. */
  @Post() create(@Body() body: CreateProviderRequest) { return this.providers.create(body); }

  /** Tests one saved provider connection. */
  @Post(':id/test') test(@Param('id') id: string) { return this.tools.testProvider(id); }

  /** Fetches model ids for one saved provider. */
  @Post(':id/models') models(@Param('id') id: string) { return this.tools.modelsForProvider(id); }

  /** Reads one managed provider. */
  @Get(':id') get(@Param('id') id: string) { return this.providers.get(id); }

  /** Updates one managed provider. */
  @Patch(':id') update(@Param('id') id: string, @Body() body: UpdateProviderRequest) { return this.providers.update(id, body); }

  /** Deletes one managed provider. */
  @Delete(':id') delete(@Param('id') id: string) { return this.providers.delete(id); }

  /** Duplicates non-secret provider configuration. */
  @Post(':id/duplicate') duplicate(@Param('id') id: string) { return this.providers.duplicate(id); }
}

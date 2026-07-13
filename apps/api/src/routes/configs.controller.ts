import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import type { AiTool, ReplaceCodexOpenAiApiKeyRequest, SaveConfigFileRequest } from '@ai-manage/shared';
import { ConfigsService } from './configs.service.js';

@Controller('config-files')
export class ConfigsController {
  constructor(private readonly service: ConfigsService) {}

  /** Lists editable config files for one tool or all tools. */
  @Get()
  configFiles(@Query('tool') tool?: AiTool) {
    return this.service.configFiles(tool);
  }

  /** Lists editable config details for feature-specific editors such as MCP. */
  @Get('editable-details')
  editableConfigDetails(@Query('tool') tool: AiTool) {
    return this.service.editableConfigDetails(tool);
  }

  /** Reads OPENAI_API_KEY from Codex auth.json. */
  @Get('codex-auth/openai-api-key')
  codexOpenAiApiKey() {
    return this.service.codexOpenAiApiKey();
  }

  /** Replaces OPENAI_API_KEY in Codex auth.json. */
  @Patch('codex-auth/openai-api-key')
  replaceCodexOpenAiApiKey(@Body() body: ReplaceCodexOpenAiApiKeyRequest) {
    return this.service.replaceCodexOpenAiApiKey(body);
  }

  /** Reads a single config file by stable id. */
  @Get(':id')
  configFile(@Param('id') id: string) {
    return this.service.configFile(id);
  }

  /** Saves a config file after hash-based conflict detection. */
  @Patch(':id')
  saveConfigFile(@Param('id') id: string, @Body() body: SaveConfigFileRequest) {
    return this.service.saveConfigFile(id, body);
  }
}

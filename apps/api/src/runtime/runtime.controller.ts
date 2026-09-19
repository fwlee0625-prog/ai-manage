import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { AiTool, SwitchProviderRequest } from '@ai-manage/shared';
import { RuntimeDetectorService } from './runtime-detector.service.js';
import { RuntimeRepository } from './runtime.repository.js';
import { SwitchService } from './switch.service.js';

@Controller('runtime')
export class RuntimeController {
  constructor(
    private readonly detector: RuntimeDetectorService,
    private readonly switches: SwitchService,
    private readonly repository: RuntimeRepository,
  ) {}

  /** Returns current managed/live runtime summary. */
  @Get()
  runtime(@Query('tool') tool?: AiTool) {
    if (!tool) throw new BadRequestException('tool is required');
    return this.detector.summary(tool);
  }

  /** Runs one transactional provider switch. */
  @Post('switch')
  switchProvider(@Body() body: SwitchProviderRequest) {
    return this.switches.switchProvider(body);
  }

  /** Lists recent switch history. */
  @Get('switch-history')
  history(@Query('tool') tool?: AiTool) {
    if (!tool) throw new BadRequestException('tool is required');
    return this.repository.history(tool);
  }
}

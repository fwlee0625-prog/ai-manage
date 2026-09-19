import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { AiTool, RuntimeAdoptRequest, RuntimeRestoreRequest, SwitchProviderRequest } from '@ai-manage/shared';
import { RuntimeDetectorService } from './runtime-detector.service.js';
import { RuntimeRepository } from './runtime.repository.js';
import { RuntimeSyncService } from './runtime-sync.service.js';
import { SwitchService } from './switch.service.js';

@Controller('runtime')
export class RuntimeController {
  constructor(
    private readonly detector: RuntimeDetectorService,
    private readonly switches: SwitchService,
    private readonly repository: RuntimeRepository,
    private readonly sync: RuntimeSyncService,
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

  /** Adopts recognizable live state as the managed active profile without rewriting live files. */
  @Post('adopt-live')
  adoptLive(@Body() body: RuntimeAdoptRequest) {
    return this.sync.adoptLive(body.tool);
  }

  /** Restores the managed active profile through the normal switch transaction. */
  @Post('restore-managed')
  restoreManaged(@Body() body: RuntimeRestoreRequest) {
    return this.sync.restoreManaged(body.tool);
  }

  /** Lists recent switch history. */
  @Get('switch-history')
  history(@Query('tool') tool?: AiTool) {
    if (!tool) throw new BadRequestException('tool is required');
    return this.repository.history(tool);
  }
}

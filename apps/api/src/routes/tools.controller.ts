import { Controller, Get } from '@nestjs/common';
import { ToolsService } from './tools.service.js';

@Controller('tools')
export class ToolsController {
  constructor(private readonly service: ToolsService) {}

  /** Returns the scan status for all supported AI tools. */
  @Get()
  tools() {
    return this.service.tools();
  }
}

import { Injectable } from '@nestjs/common';
import type { AiTool } from '@ai-manage/shared';
import { CodexAdapter } from './codex.adapter.js';
import { ClaudeAdapter } from './claude.adapter.js';
import type { AiToolAdapter } from './ai-tool.adapter.js';

@Injectable()
export class AdapterRegistry {
  constructor(
    private readonly codex: CodexAdapter,
    private readonly claude: ClaudeAdapter,
  ) {}

  all(): AiToolAdapter[] {
    return [this.codex, this.claude];
  }

  get(tool: AiTool): AiToolAdapter | undefined {
    return this.all().find(adapter => adapter.tool === tool);
  }
}

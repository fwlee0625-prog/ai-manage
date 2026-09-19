import { Injectable } from '@nestjs/common';
import type { AiTool } from '@ai-manage/shared';
import { LiveFileWriterService, type RuntimeRawSnapshot } from './live-file-writer.service.js';

@Injectable()
export class SnapshotService {
  constructor(private readonly writer: LiveFileWriterService) {}

  /** Captures all live files owned by a tool switch transaction. */
  capture(tool: AiTool): Promise<RuntimeRawSnapshot> { return this.writer.capture(tool); }

  /** Restores a previously captured tool snapshot. */
  restore(snapshot: RuntimeRawSnapshot): Promise<void> { return this.writer.restore(snapshot); }
}

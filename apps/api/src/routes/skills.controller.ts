import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import type { SaveSkillRequest } from '@ai-manage/shared';
import { SkillsService } from './skills.service.js';

@Controller('skills')
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  /** Lists discovered Codex and Agents skills. */
  @Get()
  skills() {
    return this.service.skills();
  }

  /** Reads a single skill file by stable id. */
  @Get(':id')
  skill(@Param('id') id: string) {
    return this.service.skill(id);
  }

  /** Saves a skill file after hash-based conflict detection. */
  @Patch(':id')
  saveSkill(@Param('id') id: string, @Body() body: SaveSkillRequest) {
    return this.service.saveSkill(id, body);
  }
}

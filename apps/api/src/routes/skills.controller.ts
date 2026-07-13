import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AiTool, SaveSkillRequest } from '@ai-manage/shared';
import { SkillsService } from './skills.service.js';

@Controller('skills')
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  /** Lists discovered skills for one tool or all tools. */
  @Get()
  skills(@Query('tool') tool?: AiTool) {
    return this.service.skills(tool);
  }

  /** Lists skills copied into the tool-independent local favorites directory. */
  @Get('local')
  localSkills() {
    return this.service.localSkills();
  }

  /** Copies one discovered skill directory into local favorites. */
  @Post(':id/favorite')
  favoriteSkill(@Param('id') id: string) {
    return this.service.favoriteSkill(id);
  }

  /** Removes one copied skill directory from local favorites. */
  @Delete(':id/favorite')
  unfavoriteSkill(@Param('id') id: string) {
    return this.service.unfavoriteSkill(id);
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

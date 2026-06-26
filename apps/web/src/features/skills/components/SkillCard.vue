<script setup lang="ts">
import type { SkillSummary } from "@ai-manage/shared";

const props = defineProps<{
  /** Skill summary rendered by this card. */
  skill: SkillSummary;
}>();

const emit = defineEmits<{
  select: [skillId: string];
}>();

/**
 * Emits the selected skill id to the parent list.
 */
function selectSkill() {
  emit("select", props.skill.id);
}

/**
 * Keeps keyboard activation available while using a div container.
 */
function handleKeyboardSelect(event: KeyboardEvent) {
  event.preventDefault();
  selectSkill();
}

function sourceLabel(source: SkillSummary["source"]) {
  return source === "codex" ? "Codex" : "Claude";
}
</script>

<template>
  <div
    class="skill-card"
    role="button"
    tabindex="0"
    @click="selectSkill"
    @keydown.enter="handleKeyboardSelect"
    @keydown.space="handleKeyboardSelect"
  >
    <span class="skill-card__main">
      <strong>{{ skill.name }}</strong>
      <small>{{ skill.description || "暂无简介" }}</small>
    </span>
    <span class="skill-card__footer">
      <span class="skill-card__tags">
        <el-tag
          size="small"
          :type="skill.source === 'codex' ? 'primary' : 'success'"
        >
          {{ sourceLabel(skill.source) }}
        </el-tag>
        <el-tag v-if="skill.system" size="small" type="info">
          系统
        </el-tag>
        <el-tag v-else size="small" type="warning">
          {{ skill.projectName || "项目" }}
        </el-tag>
      </span>
    </span>
  </div>
</template>

<style scoped lang="scss">
.skill-card {
  display: flex;
  min-height: 154px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  box-sizing: border-box;
  width: 100%;
  padding: 14px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface);
  color: var(--ds-color-text);
  cursor: pointer;
  text-align: left;

  &:hover,
  &:focus-visible {
    border-color: var(--ds-state-active-border);
    background: var(--ds-state-active-bg);
    outline: none;
  }
}

.skill-card__main {
  display: flex;
  min-width: 0;
  width: 100%;
  flex-direction: column;
  gap: 8px;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--ds-color-text-muted);
    display: -webkit-box;
    line-height: 1.5;
    white-space: normal;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

.skill-card__footer {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  min-width: 0;
}

.skill-card__tags {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
}
</style>

<script setup lang="ts">
import type { SkillSummary } from "@ai-manage/shared";
import { Loading, Star, StarFilled } from "@element-plus/icons-vue";

const props = defineProps<{
  /** Skill summary rendered by this card. */
  skill: SkillSummary;
  /** Whether this source skill already has a local favorite copy. */
  favorited?: boolean;
  /** Whether the local copy request is currently running. */
  favoriteLoading?: boolean;
}>();

const emit = defineEmits<{
  select: [skillId: string];
  toggleFavorite: [originSkillId: string];
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

/**
 * Toggles the local copy without triggering the card detail action.
 */
function toggleFavorite() {
  if (props.favoriteLoading) return;
  emit("toggleFavorite", props.skill.originSkillId || props.skill.id);
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
    <button
      class="skill-card__favorite"
      :class="{ 'skill-card__favorite--active': favorited || skill.scope === 'local' }"
      type="button"
      :aria-label="favorited || skill.scope === 'local' ? '取消收藏' : '收藏到本地'"
      :aria-pressed="favorited || skill.scope === 'local'"
      :title="favorited || skill.scope === 'local' ? '取消收藏' : '收藏到本地'"
      :disabled="favoriteLoading"
      @click.stop="toggleFavorite"
      @keydown.stop
    >
      <el-icon :class="{ 'is-loading': favoriteLoading }">
        <Loading v-if="favoriteLoading" />
        <StarFilled v-else-if="favorited || skill.scope === 'local'" />
        <Star v-else />
      </el-icon>
    </button>
    <span class="skill-card__main">
      <strong>{{ skill.name }}</strong>
      <small>{{ skill.description || "暂无简介" }}</small>
    </span>
    <span class="skill-card__footer">
      <span class="skill-card__tags">
        <el-tag v-if="skill.scope === 'local'" size="small" type="warning">
          本地
        </el-tag>
        <template v-else>
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
        </template>
      </span>
    </span>
  </div>
</template>

<style scoped lang="scss">
.skill-card {
  position: relative;
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

.skill-card__favorite {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ds-color-text-muted);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--ds-color-surface-soft);
    color: var(--el-color-warning);
    outline: none;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--ds-state-active-border);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.72;
  }
}

.skill-card__favorite--active {
  color: var(--el-color-warning);
}

.skill-card__main {
  display: flex;
  min-width: 0;
  width: 100%;
  padding-right: 30px;
  box-sizing: border-box;
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

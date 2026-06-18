<script setup lang="ts">
import { Close } from "@element-plus/icons-vue";
import { nextTick, shallowReactive, shallowRef, useTemplateRef } from "vue";
import { useSkills } from "./use-skills";

const {
  skills,
  selectedSkill,
  draftRaw,
  loadingList,
  loadingDetail,
  saving,
  skillInputStyle,
  isDirty,
  loadSkills,
  selectSkill,
  resetDraft,
  saveSkill,
  sourceLabel,
  formatSize,
} = useSkills();

interface DropdownExpose {
  handleClose: () => void;
  handleOpen: () => void;
}

const skillDrawerVisible = shallowRef(false);
const skillContextDropdownRef =
  useTemplateRef<DropdownExpose>("skillContextDropdown");
const skillContextMenuPosition = shallowReactive({ x: 0, y: 0 });
const skillContextVirtualRef = {
  getBoundingClientRect: () =>
    new DOMRect(skillContextMenuPosition.x, skillContextMenuPosition.y, 0, 0),
};

/**
 * Opens the side drawer and loads the selected skill detail.
 */
async function openSkillDrawer(skillId: string) {
  skillDrawerVisible.value = true;
  await selectSkill(skillId);
}

/**
 * Opens the card-area context menu at the pointer position.
 */
async function openSkillContextMenu(event: MouseEvent) {
  skillContextMenuPosition.x = event.clientX;
  skillContextMenuPosition.y = event.clientY;
  skillContextDropdownRef.value?.handleClose();
  await nextTick();
  skillContextDropdownRef.value?.handleOpen();
}

/**
 * Handles card-area context menu actions.
 */
function handleSkillContextCommand(command: string | number | object) {
  if (command === "refresh") void loadSkills();
}
</script>

<template>
  <section class="skills-page">
    <div class="skill-card-context" @contextmenu.stop.prevent="openSkillContextMenu">
      <el-scrollbar class="skill-card-scroll">
        <div v-loading="loadingList" class="skill-card-grid">
          <button
            v-for="skill in skills"
            :key="skill.id"
            type="button"
            class="skill-card"
            @click="openSkillDrawer(skill.id)"
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
              </span>
            </span>
          </button>
        </div>
        <el-empty
          v-if="!skills.length && !loadingList"
          description="暂无技能"
        />
      </el-scrollbar>
    </div>

    <el-dropdown
      ref="skillContextDropdown"
      placement="right-start"
      trigger="contextmenu"
      virtual-triggering
      :virtual-ref="skillContextVirtualRef"
      :show-arrow="false"
      popper-class="skill-context-menu"
      @command="handleSkillContextCommand"
    >
      <span class="skill-context-trigger" aria-hidden="true"></span>

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="refresh" :disabled="loadingList">
            刷新
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-drawer
      v-model="skillDrawerVisible"
      class="skill-drawer"
      direction="rtl"
      size="58%"
      :with-header="false"
    >
      <section
        v-if="selectedSkill"
        v-loading="loadingDetail"
        class="skill-drawer__content"
      >
        <header class="skill-drawer__header">
          <div class="skill-drawer__heading">
            <span class="skill-drawer__kicker">Skill Detail</span>
            <h2>{{ selectedSkill.name }}</h2>
            <p>{{ selectedSkill.description || "暂无简介" }}</p>
          </div>
        </header>

        <div class="skill-info">
          <section class="skill-info__item skill-info__item--wide">
            <span>文件</span>
            <p class="mono">{{ selectedSkill.skillFilePath }}</p>
          </section>
          <section class="skill-info__item">
            <span>来源</span>
            <strong>{{ sourceLabel(selectedSkill.source) }}</strong>
          </section>
          <section class="skill-info__item">
            <span>大小</span>
            <strong>{{ formatSize(selectedSkill.size) }}</strong>
          </section>
        </div>

        <div class="skill-editor">
          <div class="skill-editor__label">
            <span>Markdown 文档内容</span>
            <small>编辑后可直接保存到对应 Skill 文件</small>
          </div>
          <el-input
            v-model="draftRaw"
            type="textarea"
            resize="none"
            class="skill-textarea"
            :rows="28"
            :input-style="skillInputStyle"
          />
        </div>

        <footer class="skill-drawer__footer">
          <el-tag v-if="isDirty" size="small" type="warning">未保存</el-tag>
          <div class="detail-actions">
            <el-button @click="resetDraft">撤销修改</el-button>
            <el-button
              type="primary"
              :disabled="!isDirty"
              :loading="saving"
              @click="saveSkill"
            >
              保存技能
            </el-button>
            <el-button
              :icon="Close"
              circle
              title="关闭详情"
              @click="skillDrawerVisible = false"
            />
          </div>
        </footer>
      </section>

      <el-empty v-else description="请选择技能" />
    </el-drawer>
  </section>
</template>

<style scoped lang="scss">
.skills-page {
  height: calc(100vh - 112px);
  min-height: 0;
}

.skills-page :deep(.el-dropdown) {
  position: fixed;
  width: 0;
  height: 0;
  overflow: hidden;
}

.skill-card-context {
  height: 100%;
  min-height: 0;
}

.skill-context-trigger {
  display: inline-block;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

.skill-card-scroll {
  height: 100%;
  min-height: 0;
}

.skill-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  min-height: 100%;
  padding-right: 6px;
}

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

  &:hover {
    border-color: var(--ds-state-active-border);
    background: var(--ds-state-active-bg);
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

.detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.skill-drawer :deep(.el-drawer__body) {
  height: 100%;
  padding: 0;
}

.skill-drawer__content {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
  // padding: 22px;
}

.skill-drawer__header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.skill-drawer__heading {
  display: grid;
  gap: 6px;
  min-width: 0;

  h2,
  p {
    margin: 0;
  }

  h2 {
    color: var(--ds-color-text);
    font-size: 22px;
  }

  p {
    color: var(--ds-color-text-muted);
    line-height: 1.6;
  }
}

.skill-drawer__kicker {
  color: var(--ds-color-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.skill-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.skill-info__item {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface-soft);

  span {
    color: var(--ds-color-text-muted);
    font-size: 12px;
    font-weight: 600;
  }

  strong,
  p {
    margin: 0;
    min-width: 0;
    color: var(--ds-color-text);
    overflow-wrap: anywhere;
  }
}

.skill-info__item--wide {
  grid-column: 1 / -1;
}

.skill-editor {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
}

.skill-drawer__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--ds-color-border-soft);
}

.skill-editor__label {
  display: grid;
  gap: 4px;

  span {
    color: var(--ds-color-text);
    font-weight: 700;
  }

  small {
    color: var(--ds-color-text-muted);
  }
}

.skill-textarea {
  flex: 1;
  min-height: 0;
}

.skill-textarea :deep(.el-textarea__inner) {
  height: 100%;
  min-height: 0;
}

:global(.skill-context-menu) {
  width: 156px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-panel);
  box-shadow: var(--ds-shadow-hover);
}

:global(.skill-context-menu .el-dropdown-menu) {
  padding: 6px;
}

:global(.skill-context-menu .el-dropdown-menu__item) {
  border-radius: var(--ds-radius-control);
  color: var(--ds-color-text);
  font-weight: 600;
}

:global(.skill-context-menu .el-dropdown-menu__item:not(.is-disabled):hover) {
  background: var(--ds-state-active-bg);
  color: var(--ds-state-active-color);
}
</style>

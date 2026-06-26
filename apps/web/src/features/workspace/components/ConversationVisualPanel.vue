<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { chatMessageRoles } from '../../../components/chat/message';
import VirtualMessageList from '../../../components/chat/VirtualMessageList.vue';
import type { ChatMessageViewModel } from '../../../components/chat/types';
import type { SessionDetail, SkillSummary, TerminalSessionSummary } from '@ai-manage/shared';

const props = defineProps<{
  session?: SessionDetail;
  terminalSession?: TerminalSessionSummary;
  messages: ChatMessageViewModel[];
  skills: SkillSummary[];
  canStart: boolean;
  sending: boolean;
}>();

const emit = defineEmits<{
  start: [];
  send: [content: string];
}>();

const messageListRef = ref<InstanceType<typeof VirtualMessageList>>();
const draft = shallowRef('');
const followBottomTrigger = shallowRef(0);
const slashMenuDismissed = shallowRef(false);
const activeSkillIndex = shallowRef(0);

const hasMessages = computed(() => props.messages.length > 0);
const isRunningTerminal = computed(() => props.terminalSession?.status === 'running');
const canUseComposer = computed(() =>
  !props.sending && (props.canStart || Boolean(props.terminalSession)),
);
const canSubmit = computed(() =>
  Boolean(draft.value.trim()) && (isRunningTerminal.value || props.canStart) && !props.sending,
);
const panelKicker = computed(() => {
  if (props.session) return 'History';
  if (props.terminalSession) return props.terminalSession.status === 'running' ? 'Live Conversation' : 'Terminal Exited';
  return 'Conversation';
});
const panelTitle = computed(() => {
  if (props.session) return props.session.title || '历史对话';
  if (props.terminalSession) {
    return `${toolName(props.terminalSession.tool)} · ${props.terminalSession.projectName}`;
  }
  return props.canStart ? '新对话' : '选择项目开始对话';
});
const inputPlaceholder = computed(() => {
  if (!props.canStart && !props.terminalSession) return '请先在左侧选择项目';
  if (props.terminalSession?.status === 'exited') return '当前会话已退出，发送会自动启动新的会话';
  return '输入消息，Enter 发送，Shift + Enter 换行';
});
const scrollBottomKey = computed(() =>
  props.session
    ? `session:${props.session.tool}:${props.session.id}`
    : props.terminalSession
      ? `terminal:${props.terminalSession.id}`
      : 'empty',
);
const slashCommandMatch = computed(() => draft.value.match(/(^|\n)\/([^\s/]*)$/));
const slashQuery = computed(() => slashCommandMatch.value?.[2]?.toLowerCase() || '');
const slashMenuOpen = computed(() =>
  canUseComposer.value
  && Boolean(slashCommandMatch.value)
  && !slashMenuDismissed.value,
);
const filteredSkills = computed(() => {
  const query = slashQuery.value;
  const candidates = query
    ? props.skills.filter(skill =>
      skill.name.toLowerCase().includes(query)
      || skill.description.toLowerCase().includes(query),
    )
    : props.skills;
  return candidates.slice(0, 8);
});
const activeSkill = computed(() => filteredSkills.value[activeSkillIndex.value]);

/** Emits the current draft as a terminal-backed chat prompt. */
function submitDraft() {
  const content = draft.value.trimEnd();
  if (!content.trim() || !canSubmit.value) return;
  emit('send', content);
  followBottomTrigger.value += 1;
  draft.value = '';
  slashMenuDismissed.value = false;
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  if (slashMenuOpen.value && handleSlashMenuKeydown(event)) return;
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  submitDraft();
}

/** Handles keyboard navigation while the slash skill menu is visible. */
function handleSlashMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveActiveSkill(1);
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveActiveSkill(-1);
    return true;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    slashMenuDismissed.value = true;
    return true;
  }
  if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
    event.preventDefault();
    if (activeSkill.value) selectSkill(activeSkill.value);
    return true;
  }
  return false;
}

/** Moves the active skill cursor through the filtered slash menu. */
function moveActiveSkill(offset: number) {
  const count = filteredSkills.value.length;
  if (!count) {
    activeSkillIndex.value = 0;
    return;
  }
  activeSkillIndex.value = (activeSkillIndex.value + offset + count) % count;
}

/** Inserts the selected skill command into the current slash token. */
function selectSkill(skill: SkillSummary) {
  draft.value = draft.value.replace(/(^|\n)\/([^\s/]*)$/, `$1/${skill.name} `);
  slashMenuDismissed.value = true;
}

function skillScopeLabel(skill: SkillSummary) {
  return skill.scope === 'project' ? '项目' : '系统';
}

function toolName(tool: TerminalSessionSummary['tool']) {
  return tool === 'codex' ? 'Codex' : 'Claude';
}

watch(slashQuery, () => {
  slashMenuDismissed.value = false;
  activeSkillIndex.value = 0;
});

watch(filteredSkills, (skills) => {
  if (activeSkillIndex.value >= skills.length) activeSkillIndex.value = 0;
});
</script>

<template>
  <section class="conversation-visual-panel">
    <header class="conversation-visual-panel__header">
      <div class="conversation-visual-panel__heading">
        <span class="conversation-visual-panel__kicker">{{ panelKicker }}</span>
        <h1 class="conversation-visual-panel__title">
          {{ panelTitle }}
        </h1>
      </div>
      <el-tag
        v-if="terminalSession"
        size="small"
        :type="terminalSession.status === 'running' ? 'success' : 'info'"
      >
        {{ terminalSession.status === 'running' ? '运行中' : '已退出' }}
      </el-tag>
      <el-button
        size="small"
        type="primary"
        plain
        :disabled="!canStart"
        :loading="sending"
        @click="emit('start')"
      >
        新会话
      </el-button>
    </header>

    <div class="conversation-visual-panel__body">
      <VirtualMessageList
        v-if="session || hasMessages"
        ref="messageListRef"
        :messages="messages"
        mode="chat"
        :visible-roles="chatMessageRoles"
        preserve-scroll-on-update
        :scroll-bottom-key="scrollBottomKey"
        :follow-bottom-trigger="followBottomTrigger"
        natural-flow
      />
      <el-empty v-else description="请选择左侧历史对话，或选择项目后直接输入新消息" />
    </div>

    <footer class="conversation-visual-panel__composer">
      <div class="conversation-visual-panel__input-wrap">
        <div v-if="slashMenuOpen" class="slash-skill-menu">
          <button
            v-for="(skill, index) in filteredSkills"
            :key="skill.id"
            class="slash-skill-menu__item"
            :class="{ active: index === activeSkillIndex }"
            type="button"
            @mousedown.prevent="selectSkill(skill)"
          >
            <span class="slash-skill-menu__name">/{{ skill.name }}</span>
            <span class="slash-skill-menu__meta">{{ skillScopeLabel(skill) }}</span>
            <span class="slash-skill-menu__description">
              {{ skill.description || '暂无简介' }}
            </span>
          </button>
          <div v-if="!filteredSkills.length" class="slash-skill-menu__empty">
            暂无匹配技能
          </div>
        </div>

        <el-input
          v-model="draft"
          class="conversation-visual-panel__input"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 5 }"
          resize="none"
          :disabled="!canUseComposer"
          :placeholder="inputPlaceholder"
          @keydown="handleInputKeydown"
        />
      </div>
      <el-button
        class="conversation-visual-panel__send"
        type="primary"
        :loading="sending"
        :disabled="!canSubmit"
        @click="submitDraft"
      >
        发送
      </el-button>
    </footer>
  </section>
</template>

<style scoped lang="scss">
.conversation-visual-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-panel);
  background: rgb(255 255 255 / 90%);
  box-shadow: var(--ds-shadow-panel);
}

.conversation-visual-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-space-4);
  min-height: 64px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ds-color-border-soft);
}

.conversation-visual-panel__heading {
  display: grid;
  gap: 3px;
  min-width: 0;
  margin-right: auto;
}

.conversation-visual-panel__kicker {
  color: var(--ds-color-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.conversation-visual-panel__title {
  overflow: hidden;
  margin: 0;
  color: var(--ds-color-text);
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-visual-panel__body {
  min-height: 0;
  overflow: hidden;
}

.conversation-visual-panel__composer {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
  padding: 12px;
  border-top: 1px solid var(--ds-color-border-soft);
  background: rgb(248 250 252 / 92%);
}

.conversation-visual-panel__input-wrap {
  position: relative;
  min-width: 0;
}

.conversation-visual-panel__input :deep(.el-textarea__inner) {
  min-height: 48px !important;
  border-radius: var(--ds-radius-control);
  font-size: 13px;
  line-height: 1.5;
}

.conversation-visual-panel__send {
  min-width: 72px;
  min-height: 32px;
}

.slash-skill-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 5;
  display: grid;
  max-height: min(320px, 42vh);
  overflow: auto;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-panel);
  background: #ffffff;
  box-shadow: 0 14px 32px rgb(15 23 42 / 16%);
}

.slash-skill-menu__item {
  display: grid;
  grid-template-columns: minmax(120px, auto) auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 38px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  padding: 8px 10px;
  background: transparent;
  color: var(--ds-color-text);
  cursor: pointer;
  text-align: left;
}

.slash-skill-menu__item:last-child {
  border-bottom: 0;
}

.slash-skill-menu__item:hover,
.slash-skill-menu__item.active {
  background: #eef6ff;
}

.slash-skill-menu__name {
  overflow: hidden;
  font-family:
    "SFMono-Regular",
    Consolas,
    "Liberation Mono",
    monospace;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slash-skill-menu__meta {
  border: 1px solid #d7e2ef;
  border-radius: 4px;
  padding: 1px 5px;
  color: #64748b;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

.slash-skill-menu__description {
  overflow: hidden;
  color: var(--ds-color-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slash-skill-menu__empty {
  padding: 12px;
  color: var(--ds-color-text-muted);
  font-size: 13px;
}
</style>

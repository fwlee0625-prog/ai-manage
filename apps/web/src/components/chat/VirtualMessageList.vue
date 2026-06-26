<template>
  <div
    ref="scroller"
    class="virtual-message-list"
    @scroll="handleScroll"
    @wheel.passive="handleWheel"
    @touchstart.passive="handleTouchStart"
    @touchmove.passive="handleTouchMove"
  >
    <div v-if="filteredMessages.length && naturalFlow" class="message-flow-list">
      <ChatMessageItem
        v-for="message in filteredMessages"
        :key="message.id"
        :message="message"
        :mode="mode"
        :expanded="expandedMessages.has(message.id)"
        @toggle="toggleExpanded(message.id)"
      />
    </div>
    <div v-else-if="filteredMessages.length" class="virtual-spacer" :style="{ height: `${totalHeight}px` }">
      <div
        v-for="entry in visibleEntries"
        :key="`${entry.message.id}-${entry.index}`"
        class="virtual-row"
        :data-index="entry.index"
        :style="{ transform: `translateY(${entry.top}px)` }"
      >
        <ChatMessageItem
          :message="entry.message"
          :mode="mode"
          :expanded="expandedMessages.has(entry.message.id)"
          @toggle="toggleExpanded(entry.message.id)"
        />
      </div>
    </div>
    <el-empty v-else description="暂无可显示消息" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ChatMessageItem from './ChatMessageItem.vue';
import type { ChatDisplayMode, ChatMessageRole, ChatMessageViewModel } from './types';

const props = withDefaults(defineProps<{
  messages: ChatMessageViewModel[];
  mode: ChatDisplayMode;
  visibleRoles: ChatMessageRole[];
  estimatedItemHeight?: number;
  preserveScrollOnUpdate?: boolean;
  scrollBottomKey?: string | number;
  followBottomTrigger?: string | number;
  naturalFlow?: boolean;
}>(), {
  estimatedItemHeight: 150,
  preserveScrollOnUpdate: false,
  scrollBottomKey: '',
  followBottomTrigger: 0,
  naturalFlow: false,
});

const scroller = ref<HTMLElement>();
const scrollTop = ref(0);
const viewportHeight = ref(0);
const itemHeights = ref(new Map<number, number>());
const expandedMessages = ref(new Set<string>());
const overscanPx = 600;
let resizeObserver: ResizeObserver | undefined;
let measureFrame = 0;
let scrollFrame = 0;
let scrollRetryFrame = 0;
let lastScrollTop = 0;
let userScrollIntent = false;
let ignoreScrollEvent = false;
let touchStartY = 0;
let suppressAutoBottomUntil = 0;
const followDisableDistancePx = 180;
const nearBottomThresholdPx = 96;
const userScrollSuppressionMs = 2000;
const shouldFollowBottom = ref(false);
const naturalFlow = computed(() => props.naturalFlow);

const filteredMessages = computed(() => {
  const visible = new Set(props.visibleRoles);
  return props.messages.filter(message => visible.has(message.role));
});

const positions = computed(() => {
  let top = 0;
  return filteredMessages.value.map((message, index) => {
    const height = itemHeights.value.get(index) || props.estimatedItemHeight;
    const entry = { index, message, top, height };
    top += height;
    return entry;
  });
});

const totalHeight = computed(() => {
  const last = positions.value.at(-1);
  return last ? last.top + last.height : 0;
});

const visibleEntries = computed(() => {
  if (!positions.value.length) return [];
  const startTop = Math.max(0, scrollTop.value - overscanPx);
  const endTop = scrollTop.value + Math.max(viewportHeight.value, props.estimatedItemHeight * 8) + overscanPx;
  const startIndex = findStartIndex(startTop);
  const entries = [];
  for (let index = startIndex; index < positions.value.length; index += 1) {
    const entry = positions.value[index];
    if (entry.top > endTop) break;
    entries.push(entry);
  }
  return entries;
});

function findStartIndex(targetTop: number) {
  let low = 0;
  let high = positions.value.length - 1;
  let result = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (positions.value[mid].top <= targetTop) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

function handleScroll() {
  if (!scroller.value) return;
  const nextScrollTop = scroller.value.scrollTop;
  const isUserScrollingUp = userScrollIntent && nextScrollTop < lastScrollTop;
  scrollTop.value = nextScrollTop;
  if (
    shouldFollowBottom.value
    && !ignoreScrollEvent
    && isUserScrollingUp
    && !isNearBottom(followDisableDistancePx)
  ) {
    suppressAutoBottom();
  }
  lastScrollTop = nextScrollTop;
  ignoreScrollEvent = false;
  userScrollIntent = false;
}

function handleUserScrollIntent(isScrollingUp: boolean) {
  userScrollIntent = true;
  if (isScrollingUp) suppressAutoBottom();
}

function handleWheel(event: WheelEvent) {
  handleUserScrollIntent(event.deltaY < 0);
}

function handleTouchStart(event: TouchEvent) {
  touchStartY = event.touches[0]?.clientY || 0;
}

function handleTouchMove(event: TouchEvent) {
  const currentY = event.touches[0]?.clientY || touchStartY;
  handleUserScrollIntent(currentY > touchStartY);
  touchStartY = currentY;
}

function updateViewportHeight() {
  viewportHeight.value = scroller.value?.clientHeight || 0;
}

function scheduleMeasure() {
  if (measureFrame) cancelAnimationFrame(measureFrame);
  measureFrame = requestAnimationFrame(() => {
    measureFrame = 0;
    measureVisibleRows();
  });
}

function measureVisibleRows() {
  if (!scroller.value || props.naturalFlow) return;
  const nextHeights = new Map(itemHeights.value);
  let changed = false;
  scroller.value.querySelectorAll<HTMLElement>('.virtual-row').forEach((row) => {
    const index = Number(row.dataset.index);
    if (Number.isNaN(index)) return;
    const height = row.offsetHeight;
    if (height > 0 && nextHeights.get(index) !== height) {
      nextHeights.set(index, height);
      changed = true;
    }
  });
  if (changed) itemHeights.value = nextHeights;
}

function toggleExpanded(id: string) {
  const nextExpanded = new Set(expandedMessages.value);
  if (nextExpanded.has(id)) {
    nextExpanded.delete(id);
  } else {
    nextExpanded.add(id);
  }
  expandedMessages.value = nextExpanded;
  nextTick(scheduleMeasure);
}

function scrollToTop() {
  if (scroller.value) scroller.value.scrollTop = 0;
  scrollTop.value = 0;
}

function scrollToBottom() {
  if (!scroller.value) return;
  ignoreScrollEvent = true;
  scroller.value.scrollTop = Math.max(0, scroller.value.scrollHeight - scroller.value.clientHeight);
  scrollTop.value = scroller.value.scrollTop;
  lastScrollTop = scrollTop.value;
}

function cancelScheduledScroll() {
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  if (scrollRetryFrame) cancelAnimationFrame(scrollRetryFrame);
  scrollFrame = 0;
  scrollRetryFrame = 0;
}

function suppressAutoBottom() {
  shouldFollowBottom.value = false;
  suppressAutoBottomUntil = Date.now() + userScrollSuppressionMs;
  cancelScheduledScroll();
}

function isAutoBottomSuppressed() {
  return Date.now() < suppressAutoBottomUntil;
}

function isNearBottom(thresholdPx = nearBottomThresholdPx) {
  if (!scroller.value) return true;
  const distance = scroller.value.scrollHeight - scroller.value.clientHeight - scroller.value.scrollTop;
  return distance <= thresholdPx;
}

function scheduleScrollToBottom(retries = 4) {
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    measureVisibleRows();
    scrollToBottom();
    scheduleMeasure();
    scheduleScrollToBottomRetry(retries);
  });
}

function scheduleScrollToBottomRetry(retries: number) {
  if (scrollRetryFrame) cancelAnimationFrame(scrollRetryFrame);
  if (retries <= 0) return;
  scrollRetryFrame = requestAnimationFrame(() => {
    scrollRetryFrame = 0;
    measureVisibleRows();
    scrollToBottom();
    scheduleScrollToBottomRetry(retries - 1);
  });
}

function resetListState(forceBottom = false) {
  itemHeights.value = new Map();
  expandedMessages.value = new Set();
  nextTick(() => {
    if (props.preserveScrollOnUpdate && isAutoBottomSuppressed() && !forceBottom) {
      scheduleMeasure();
      return;
    }
    if (forceBottom || !props.preserveScrollOnUpdate || shouldFollowBottom.value || isNearBottom()) {
      scheduleScrollToBottom();
      return;
    }
    scheduleMeasure();
  });
}

function handleMessagesChanged() {
  nextTick(() => {
    if (props.preserveScrollOnUpdate && isAutoBottomSuppressed() && !shouldFollowBottom.value) {
      scheduleMeasure();
      return;
    }
    if (!props.preserveScrollOnUpdate || shouldFollowBottom.value || isNearBottom()) {
      scheduleScrollToBottom();
      return;
    }
    scheduleMeasure();
  });
}

function enableFollowBottom() {
  suppressAutoBottomUntil = 0;
  shouldFollowBottom.value = true;
  scheduleScrollToBottom();
}

watch(() => props.messages, handleMessagesChanged);

watch(
  () => [props.mode, props.visibleRoles.join(',')],
  () => resetListState(),
);

watch(
  () => props.scrollBottomKey,
  () => {
    shouldFollowBottom.value = false;
    resetListState(true);
  },
);

watch(
  () => props.followBottomTrigger,
  enableFollowBottom,
);

watch(visibleEntries, () => nextTick(scheduleMeasure));

onMounted(() => {
  updateViewportHeight();
  resizeObserver = new ResizeObserver(() => {
    updateViewportHeight();
    scheduleMeasure();
  });
  if (scroller.value) resizeObserver.observe(scroller.value);
  nextTick(() => {
    scheduleMeasure();
    scheduleScrollToBottom();
  });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (measureFrame) cancelAnimationFrame(measureFrame);
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  if (scrollRetryFrame) cancelAnimationFrame(scrollRetryFrame);
});

defineExpose({ scrollToBottom: () => scheduleScrollToBottom(), scrollToTop, enableFollowBottom });
</script>

<style scoped>
.virtual-message-list {
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: #f7f9fc;
}

.virtual-spacer {
  position: relative;
  min-height: 100%;
}

.virtual-row {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
</style>

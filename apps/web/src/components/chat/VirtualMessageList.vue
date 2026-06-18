<template>
  <div ref="scroller" class="virtual-message-list" @scroll="handleScroll">
    <div v-if="filteredMessages.length" class="virtual-spacer" :style="{ height: `${totalHeight}px` }">
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
}>(), {
  estimatedItemHeight: 150,
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
  scrollTop.value = scroller.value?.scrollTop || 0;
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
  if (!scroller.value) return;
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
  scroller.value.scrollTop = totalHeight.value;
  scrollTop.value = scroller.value.scrollTop;
}

function scheduleScrollToBottom() {
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    scrollToBottom();
    scheduleMeasure();
  });
}

function resetListState() {
  itemHeights.value = new Map();
  expandedMessages.value = new Set();
  nextTick(scheduleScrollToBottom);
}

watch(
  () => [props.messages, props.mode, props.visibleRoles.join(',')],
  resetListState,
);

watch(visibleEntries, () => nextTick(scheduleMeasure));

onMounted(() => {
  updateViewportHeight();
  resizeObserver = new ResizeObserver(() => {
    updateViewportHeight();
    scheduleMeasure();
  });
  if (scroller.value) resizeObserver.observe(scroller.value);
  nextTick(scheduleMeasure);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (measureFrame) cancelAnimationFrame(measureFrame);
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
});

defineExpose({ scrollToBottom, scrollToTop });
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

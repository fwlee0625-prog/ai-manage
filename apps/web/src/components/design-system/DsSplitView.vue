<script setup lang="ts">
/**
 * Two-column shell for PC workflows with a list area and a detail area.
 */
defineProps<{
  leftWidth?: string;
}>();
</script>

<template>
  <section class="ds-split-view" :style="{ '--ds-split-left': leftWidth || '42%' }">
    <div class="ds-split-view__pane ds-split-view__pane--left">
      <slot name="left" />
    </div>
    <div class="ds-split-view__pane ds-split-view__pane--right">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.ds-split-view {
  display: grid;
  grid-template-columns: minmax(300px, var(--ds-split-left)) minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - 112px);
  min-height: 0;
}

.ds-split-view__pane {
  min-width: 0;
  min-height: 0;
}
</style>

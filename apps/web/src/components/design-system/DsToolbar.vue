<script setup lang="ts">
/**
 * Horizontal command strip for filters, refresh actions and page tools.
 */
defineProps<{
  compact?: boolean;
}>();
</script>

<template>
  <div class="ds-toolbar" :class="{ 'ds-toolbar--compact': compact }">
    <div v-if="$slots.default" class="ds-toolbar__main">
      <slot />
    </div>
    <div v-if="$slots.actions" class="ds-toolbar__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.ds-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-space-3);
  min-width: 0;
}

.ds-toolbar__main,
.ds-toolbar__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--ds-space-2);
  min-width: 0;
}

.ds-toolbar__main {
  flex: 1 1 auto;
}

.ds-toolbar__actions {
  flex: 0 0 auto;
}

.ds-toolbar--compact {
  gap: var(--ds-space-2);
}
</style>

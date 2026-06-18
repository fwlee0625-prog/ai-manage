<script setup lang="ts">
/**
 * Panel shell for feature-level content blocks.
 */
defineProps<{
  title?: string;
  description?: string;
  compact?: boolean;
  fill?: boolean;
}>();
</script>

<template>
  <section
    class="ds-panel"
    :class="{ 'ds-panel--compact': compact, 'ds-panel--fill': fill }"
  >
    <header
      v-if="title || description || $slots.header || $slots.actions"
      class="ds-panel__header"
    >
      <slot name="header">
        <div class="ds-panel__heading">
          <h2 v-if="title" class="ds-panel__title">{{ title }}</h2>
          <p v-if="description" class="ds-panel__description">{{ description }}</p>
        </div>
      </slot>
      <div v-if="$slots.actions" class="ds-panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="ds-panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.ds-panel {
  min-width: 0;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-panel);
  background: rgb(255 255 255 / 88%);
  box-shadow: var(--ds-shadow-panel);
}

.ds-panel--fill {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.ds-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-space-4);
  min-height: 56px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--ds-color-border-soft);
}

.ds-panel__heading {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.ds-panel__title {
  margin: 0;
  color: var(--ds-color-text);
  font-size: 15px;
  font-weight: 700;
}

.ds-panel__description {
  margin: 0;
  color: var(--ds-color-text-muted);
  font-size: 12px;
}

.ds-panel__actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--ds-space-2);
}

.ds-panel__body {
  padding: 16px;
}

.ds-panel--fill .ds-panel__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.ds-panel--compact {
  .ds-panel__header {
    min-height: 48px;
    padding: 10px 14px;
  }

  .ds-panel__body {
    padding: 14px;
  }
}
</style>

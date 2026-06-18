<script setup lang="ts">
/**
 * Page-level heading with optional actions for dense PC management pages.
 */
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <header class="ds-page-header">
    <div class="ds-page-header__copy">
      <h1 class="ds-page-header__title">{{ title }}</h1>
      <p v-if="description" class="ds-page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="ds-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped lang="scss">
.ds-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-space-4);
  min-width: 0;
}

.ds-page-header__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.ds-page-header__title {
  margin: 0;
  color: var(--ds-color-text);
  font-size: 18px;
  font-weight: 800;
}

.ds-page-header__description {
  margin: 0;
  color: var(--ds-color-text-muted);
  font-size: 12px;
}

.ds-page-header__actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--ds-space-2);
}
</style>

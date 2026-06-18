<script setup lang="ts">
/**
 * Metric card for dashboard-style summary values.
 */
defineProps<{
  title: string;
  value: string | number;
  description?: string;
  meta?: string;
  accent?: 'brand' | 'info' | 'warning' | 'danger';
}>();
</script>

<template>
  <article
    class="ds-metric-card"
    :class="`ds-metric-card--${accent || 'brand'}`"
  >
    <div class="ds-metric-card__glow" aria-hidden="true"></div>
    <div class="ds-metric-card__header">
      <span class="ds-metric-card__title">{{ title }}</span>
      <slot name="status" />
    </div>
    <div class="ds-metric-card__value">{{ value }}</div>
    <p v-if="description" class="ds-metric-card__description">{{ description }}</p>
    <p v-if="meta" class="ds-metric-card__meta mono">{{ meta }}</p>
    <slot />
  </article>
</template>

<style scoped lang="scss">
.ds-metric-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-panel);
  background: rgb(255 255 255 / 92%);
  box-shadow: var(--ds-shadow-panel);
}

.ds-metric-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--ds-gradient-brand);
  content: "";
}

.ds-metric-card__glow {
  position: absolute;
  top: -42px;
  right: -42px;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  background: rgb(128 237 153 / 18%);
  pointer-events: none;
}

.ds-metric-card__header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-space-3);
  padding: 16px 16px 0 20px;
}

.ds-metric-card__title {
  overflow: hidden;
  color: var(--ds-color-text-muted);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-metric-card__value {
  position: relative;
  padding: 10px 16px 0 20px;
  color: var(--ds-color-text);
  font-size: 30px;
  font-weight: 800;
  line-height: 1.1;
}

.ds-metric-card__description {
  position: relative;
  margin: 8px 16px 0 20px;
  color: var(--ds-color-text-muted);
  font-size: 13px;
}

.ds-metric-card__meta {
  position: relative;
  margin: 10px 16px 16px 20px;
  overflow: hidden;
  color: var(--ds-color-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-metric-card--info::before {
  background: var(--ds-color-info);
}

.ds-metric-card--info .ds-metric-card__glow {
  background: rgb(59 130 246 / 14%);
}

.ds-metric-card--warning::before {
  background: var(--ds-color-warning);
}

.ds-metric-card--warning .ds-metric-card__glow {
  background: rgb(245 158 11 / 16%);
}

.ds-metric-card--danger::before {
  background: var(--ds-color-danger);
}

.ds-metric-card--danger .ds-metric-card__glow {
  background: rgb(239 68 68 / 14%);
}
</style>

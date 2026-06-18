<script setup lang="ts">
/**
 * Compact status indicator for high-frequency UI states.
 */
defineProps<{
  tone?: 'success' | 'info' | 'warning' | 'danger' | 'neutral';
}>();
</script>

<template>
  <span class="ds-status-pill" :class="`ds-status-pill--${tone || 'neutral'}`">
    <slot />
  </span>
</template>

<style scoped lang="scss">
.ds-status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.ds-status-pill--success {
  border-color: rgb(87 204 153 / 36%);
  background: rgb(128 237 153 / 18%);
  color: #168255;
}

.ds-status-pill--info {
  border-color: rgb(59 130 246 / 28%);
  background: rgb(59 130 246 / 10%);
  color: #1d63c5;
}

.ds-status-pill--warning {
  border-color: rgb(245 158 11 / 32%);
  background: rgb(245 158 11 / 12%);
  color: #a16207;
}

.ds-status-pill--danger {
  border-color: rgb(239 68 68 / 28%);
  background: rgb(239 68 68 / 10%);
  color: #b91c1c;
}

.ds-status-pill--neutral {
  border-color: var(--ds-color-border);
  background: var(--ds-color-surface-soft);
  color: var(--ds-color-text-muted);
}
</style>

<script setup lang="ts">
/**
 * Read-only code surface used by logs, config previews and file previews.
 */
defineProps<{
  content?: string;
}>();
</script>

<template>
  <pre class="ds-code-block">{{ content || '' }}</pre>
</template>

<style scoped lang="scss">
.ds-code-block {
  margin: 0;
  min-height: 0;
  overflow: auto;
  padding: 14px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-code-bg);
  color: var(--ds-color-code-fg);
  font-family:
    "SFMono-Regular",
    Consolas,
    "Liberation Mono",
    monospace;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

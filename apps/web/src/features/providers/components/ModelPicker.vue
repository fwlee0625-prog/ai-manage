<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ modelValue: string; models: string[]; loading?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; fetch: [] }>();

const hasModels = computed(() => props.models.length > 0);

/** Filters the fetched models against what the user already typed. */
function fetchSuggestions(query: string, callback: (items: { value: string }[]) => void) {
  const needle = query.trim().toLowerCase();
  const matched = needle ? props.models.filter(model => model.toLowerCase().includes(needle)) : props.models;
  callback(matched.map(value => ({ value })));
}

/** Free text is always authoritative here, so an upstream list is only ever a suggestion source. */
function updateModelValue(value: string | number) {
  emit('update:modelValue', String(value ?? ''));
}
</script>
<template>
  <div class="model-picker">
    <el-autocomplete
      :model-value="modelValue"
      :fetch-suggestions="fetchSuggestions"
      :placeholder="hasModels ? '输入模型名，或从建议中选择' : '直接输入模型名，例如 glm-4-plus'"
      clearable
      @update:model-value="updateModelValue"
    />
    <el-button :loading="loading" @click="$emit('fetch')">获取模型</el-button>
  </div>
</template>
<style scoped>.model-picker{display:grid;grid-template-columns:1fr auto;gap:8px}.model-picker :deep(.el-autocomplete){width:100%}</style>

<script setup lang="ts">
defineProps<{ modelValue: string; models: string[]; loading?: boolean }>();
defineEmits<{ 'update:modelValue': [value: string]; fetch: [] }>();
</script>
<template><div class="model-picker"><el-select filterable allow-create default-first-option :model-value="modelValue" @update:model-value="$emit('update:modelValue', String($event))"><el-option v-for="model in models" :key="model" :label="model" :value="model" /></el-select><el-button :loading="loading" @click="$emit('fetch')">获取模型</el-button></div></template>
<style scoped>.model-picker{display:grid;grid-template-columns:1fr auto;gap:8px}</style>

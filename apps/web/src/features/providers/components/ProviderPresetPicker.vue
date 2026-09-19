<script setup lang="ts">
import type { ProviderPreset } from '@ai-manage/shared';
defineProps<{ presets: ProviderPreset[]; modelValue?: string }>();
defineEmits<{ 'update:modelValue': [value: string]; select: [value: string] }>();
</script>
<template><div class="presets"><button v-for="preset in presets" :key="preset.id" type="button" :class="{active:modelValue===preset.id}" @click="$emit('update:modelValue', preset.id); $emit('select', preset.id)"><strong>{{ preset.name }}</strong><span>{{ preset.providerType }}</span></button></div></template>
<style scoped>.presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.presets button{display:flex;flex-direction:column;gap:4px;padding:12px;border:1px solid #dcdfe6;border-radius:8px;background:#fff;text-align:left;cursor:pointer}.presets button.active{border-color:#409eff;background:#ecf5ff}.presets span{color:#909399;font-size:12px}</style>

<script setup lang="ts">
import type { ProviderPreset } from '@ai-manage/shared';
import { providerIconSvg } from '../provider-icons';

defineProps<{ presets: ProviderPreset[]; modelValue?: string }>();
defineEmits<{ 'update:modelValue': [value: string]; select: [value: string] }>();
</script>

<template>
  <div class="presets">
    <button
      v-for="preset in presets"
      :key="preset.id"
      type="button"
      :class="{ active: modelValue === preset.id }"
      @click="$emit('update:modelValue', preset.id); $emit('select', preset.id)"
    >
      <span class="presets__icon">
        <span v-if="providerIconSvg(preset.icon)" class="presets__svg" v-html="providerIconSvg(preset.icon)" />
        <span v-else class="presets__monogram">{{ preset.name.slice(0, 1) }}</span>
      </span>
      <span class="presets__text"><strong>{{ preset.name }}</strong><span>{{ preset.providerType }}</span></span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.presets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.presets button { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--ds-color-border-soft); border-radius: var(--ds-radius-control); background: var(--ds-color-surface); text-align: left; cursor: pointer; }
.presets button.active { border-color: var(--ds-state-active-border); background: var(--ds-state-active-bg); }
.presets__icon { display: flex; width: 26px; height: 26px; flex: none; align-items: center; justify-content: center; border-radius: 50%; background: var(--ds-color-surface-soft); color: var(--ds-color-text); font-size: 16px; overflow: hidden; }
.presets__svg { display: flex; align-items: center; justify-content: center; }
.presets__monogram { font-size: 13px; font-weight: 600; }
.presets__text { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.presets__text strong { font-size: 13px; font-weight: 600; }
.presets__text span { color: var(--ds-color-text-muted); font-size: 12px; }
</style>

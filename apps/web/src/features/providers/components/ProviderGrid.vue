<script setup lang="ts">
import type { AiProviderProfile, ProviderHealthStatus } from '@ai-manage/shared';
import ProviderCard from './ProviderCard.vue';

const props = defineProps<{
  providers: AiProviderProfile[];
  activeId?: string;
  switchingId?: string;
  healthById?: Record<string, ProviderHealthStatus>;
}>();
const emit = defineEmits<{
  switch: [provider: AiProviderProfile];
  edit: [provider: AiProviderProfile];
  duplicate: [provider: AiProviderProfile];
  test: [provider: AiProviderProfile];
  remove: [provider: AiProviderProfile];
  reorder: [providerIds: string[]];
}>();

/** Moves one Provider by one position and emits the full stable-id order. */
function move(index: number, delta: number) {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= props.providers.length) return;
  const ids = props.providers.map(provider => provider.id);
  [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
  emit('reorder', ids);
}
</script>

<template>
  <div v-if="providers.length" class="grid">
    <ProviderCard
      v-for="(provider, index) in providers"
      :key="provider.id"
      :provider="provider"
      :active="provider.id === activeId"
      :switching="provider.id === switchingId"
      :health-status="healthById?.[provider.id] || 'unknown'"
      :can-move-up="index > 0"
      :can-move-down="index < providers.length - 1"
      @move-up="move(index, -1)"
      @move-down="move(index, 1)"
      @switch="$emit('switch', provider)"
      @edit="$emit('edit', provider)"
      @duplicate="$emit('duplicate', provider)"
      @test="$emit('test', provider)"
      @remove="$emit('remove', provider)"
    />
  </div>
  <el-empty v-else description="暂无托管 Provider" />
</template>
<style scoped>.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}</style>

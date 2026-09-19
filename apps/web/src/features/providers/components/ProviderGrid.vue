<script setup lang="ts">
import type { AiProviderProfile } from '@ai-manage/shared';
import ProviderCard from './ProviderCard.vue';
defineProps<{ providers: AiProviderProfile[]; activeId?: string; switchingId?: string }>();
defineEmits<{ switch: [provider: AiProviderProfile]; edit: [provider: AiProviderProfile]; duplicate: [provider: AiProviderProfile]; test: [provider: AiProviderProfile]; remove: [provider: AiProviderProfile] }>();
</script>
<template>
  <div v-if="providers.length" class="grid">
    <ProviderCard v-for="provider in providers" :key="provider.id" :provider="provider" :active="provider.id === activeId" :switching="provider.id === switchingId"
      @switch="$emit('switch', provider)" @edit="$emit('edit', provider)" @duplicate="$emit('duplicate', provider)" @test="$emit('test', provider)" @remove="$emit('remove', provider)" />
  </div>
  <el-empty v-else description="暂无托管 Provider" />
</template>
<style scoped>.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}</style>

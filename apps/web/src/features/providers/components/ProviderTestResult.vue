<script setup lang="ts">
import type { ProviderTestResponse } from '@ai-manage/shared';
defineProps<{ result?: ProviderTestResponse }>();
</script>
<template><el-alert v-if="result" :type="result.ok ? 'success' : 'warning'" :title="result.message" :closable="false" show-icon /></template>

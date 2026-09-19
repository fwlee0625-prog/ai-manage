<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { AiProviderProfile, RuntimeSummary, SwitchHistoryEntry } from '@ai-manage/shared';
import { api } from '../../api';
import { selectedTool } from '../../state/app-state';

const runtime = ref<RuntimeSummary>();
const providers = ref<AiProviderProfile[]>([]);
const history = ref<SwitchHistoryEntry[]>([]);
const loading = ref(false);
const switchingId = ref('');

const recentProviders = computed(() => {
  const byId = new Map(providers.value.map(provider => [provider.id, provider]));
  const ordered: AiProviderProfile[] = [];
  const seen = new Set<string>();
  for (const entry of history.value) {
    if (entry.status !== 'success' || !entry.toProviderId || seen.has(entry.toProviderId)) continue;
    const provider = byId.get(entry.toProviderId);
    if (!provider) continue;
    ordered.push(provider);
    seen.add(provider.id);
    if (ordered.length >= 5) break;
  }
  for (const provider of providers.value) {
    if (seen.has(provider.id)) continue;
    ordered.push(provider);
    if (ordered.length >= 5) break;
  }
  return ordered;
});

const summaryLabel = computed(() => [
  runtime.value?.providerName,
  runtime.value?.accountSummary,
  runtime.value?.model,
].filter(Boolean).join(' · ') || '未识别运行环境');

/** Refreshes the lightweight runtime switcher state for the selected tool. */
async function load() {
  const tool = selectedTool.value;
  loading.value = true;
  try {
    const [nextRuntime, nextProviders, nextHistory] = await Promise.all([
      api.runtime(tool),
      api.providers(tool),
      api.switchHistory(tool),
    ]);
    if (selectedTool.value !== tool) return;
    runtime.value = nextRuntime;
    providers.value = nextProviders;
    history.value = nextHistory;
  } finally {
    loading.value = false;
  }
}

/** Switches to a recent Provider through the transactional Runtime API. */
async function switchTo(provider: AiProviderProfile) {
  if (provider.id === runtime.value?.managedProviderId) return;
  switchingId.value = provider.id;
  try {
    const result = await api.switchProvider({ tool: provider.tool, providerId: provider.id });
    if (!result.success) throw new Error(`切换失败：${result.stage || 'unknown'}`);
    ElMessage.success(`已切换到 ${provider.name}`);
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error));
  } finally {
    switchingId.value = '';
  }
}

watch(selectedTool, () => void load(), { immediate: true });
</script>

<template>
  <el-popover placement="bottom-end" :width="360" trigger="click" @show="load">
    <template #reference>
      <button class="runtime-trigger" type="button">
        <span class="runtime-trigger__tool">{{ selectedTool === 'codex' ? 'Codex AI' : 'Claude AI' }}</span>
        <span class="runtime-trigger__summary">{{ summaryLabel }}</span>
      </button>
    </template>

    <div class="quick-switch">
      <header>
        <div>
          <strong>快速切换</strong>
          <p>{{ summaryLabel }}</p>
        </div>
        <el-tag :type="runtime?.syncStatus === 'synced' ? 'success' : 'warning'" size="small">
          {{ runtime?.syncStatus || 'loading' }}
        </el-tag>
      </header>

      <div v-loading="loading" class="quick-switch__list">
        <button
          v-for="provider in recentProviders"
          :key="provider.id"
          type="button"
          class="quick-switch__item"
          :class="{ active: provider.id === runtime?.managedProviderId }"
          :disabled="switchingId === provider.id"
          @click="switchTo(provider)"
        >
          <span>
            <strong>{{ provider.name }}</strong>
            <small>{{ provider.defaultModel || provider.endpoint || provider.providerType }}</small>
          </span>
          <el-tag v-if="provider.id === runtime?.managedProviderId" size="small" type="success">当前</el-tag>
          <span v-else-if="switchingId === provider.id">切换中…</span>
        </button>
        <el-empty v-if="!recentProviders.length && !loading" description="暂无 Provider" :image-size="54" />
      </div>

      <router-link to="/providers" class="quick-switch__manage">管理模型与账号</router-link>
    </div>
  </el-popover>
</template>

<style scoped lang="scss">
.runtime-trigger {
  display: grid;
  max-width: 360px;
  padding: 7px 12px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: var(--ds-color-surface);
  text-align: left;
  cursor: pointer;
}
.runtime-trigger__tool { color: var(--ds-color-text); font-size: 12px; font-weight: 700; }
.runtime-trigger__summary { overflow: hidden; color: var(--ds-color-text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.quick-switch { display: grid; gap: 12px; }
.quick-switch header { display: flex; justify-content: space-between; gap: 12px; }
.quick-switch header p { margin: 4px 0 0; color: var(--ds-color-text-muted); font-size: 12px; }
.quick-switch__list { display: grid; gap: 6px; min-height: 60px; }
.quick-switch__item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px; border: 1px solid var(--ds-color-border-soft); border-radius: var(--ds-radius-control); background: var(--ds-color-surface); text-align: left; cursor: pointer; }
.quick-switch__item.active { border-color: var(--ds-state-active-border); background: var(--ds-state-active-bg); }
.quick-switch__item span:first-child { display: grid; min-width: 0; }
.quick-switch__item small { overflow: hidden; color: var(--ds-color-text-muted); text-overflow: ellipsis; white-space: nowrap; }
.quick-switch__manage { justify-self: end; color: var(--ds-state-active-color); font-size: 12px; text-decoration: none; }
</style>

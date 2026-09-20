<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import type { AiProviderProfile, AiTool, RuntimeSummary, SwitchHistoryEntry } from '@ai-manage/shared';
import { api } from '../../api';

const props = defineProps<{ tool: AiTool }>();

const router = useRouter();
const runtime = ref<RuntimeSummary>();
const providers = ref<AiProviderProfile[]>([]);
const history = ref<SwitchHistoryEntry[]>([]);
const loading = ref(false);
const switchingId = ref('');

const summaryLine = computed(() => {
  const parts = [runtime.value?.accountSummary, runtime.value?.model].filter(Boolean);
  return parts.join(' · ') || '点击快速切换 Provider';
});

const recentProviders = computed(() => {
  const byId = new Map(providers.value.map(provider => [provider.id, provider]));
  const orderedIds: string[] = [];
  const activeId = runtime.value?.managedProviderId;
  if (activeId) orderedIds.push(activeId);
  for (const entry of history.value) {
    if (entry.status !== 'success' || !entry.toProviderId || orderedIds.includes(entry.toProviderId)) continue;
    orderedIds.push(entry.toProviderId);
  }
  for (const provider of providers.value) {
    if (!orderedIds.includes(provider.id)) orderedIds.push(provider.id);
  }
  return orderedIds
    .map(id => byId.get(id))
    .filter((provider): provider is AiProviderProfile => !!provider)
    .slice(0, 5);
});

/** Loads the lightweight runtime summary and recent Provider candidates for quick switching. */
async function load() {
  const tool = props.tool;
  loading.value = true;
  try {
    const [nextRuntime, nextProviders, nextHistory] = await Promise.all([
      api.runtime(tool),
      api.providers(tool),
      api.switchHistory(tool),
    ]);
    if (props.tool !== tool) return;
    runtime.value = nextRuntime;
    providers.value = nextProviders;
    history.value = nextHistory;
  } catch {
    if (props.tool === tool) {
      runtime.value = undefined;
      providers.value = [];
      history.value = [];
    }
  } finally {
    if (props.tool === tool) loading.value = false;
  }
}

/** Switches the selected Provider through the transactional Runtime Engine. */
async function switchProvider(providerId: string) {
  const provider = providers.value.find(item => item.id === providerId);
  if (!provider || provider.id === runtime.value?.managedProviderId) return;
  switchingId.value = provider.id;
  try {
    const result = await api.switchProvider({ tool: props.tool, providerId: provider.id });
    if (!result.success) {
      throw new Error(`切换失败：${result.stage || 'unknown'}；回滚：${result.rolledBack ? '成功' : '未完成'}`);
    }
    ElMessage.success(`已切换到 ${provider.name}`);
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error));
  } finally {
    switchingId.value = '';
  }
}

/** Handles dropdown commands without exposing Provider management actions inside the compact switcher. */
async function handleCommand(command: string) {
  if (command === 'manage') {
    await router.push('/providers');
    return;
  }
  if (command.startsWith('provider:')) {
    await switchProvider(command.slice('provider:'.length));
  }
}

watch(() => props.tool, load, { immediate: true });
</script>

<template>
  <el-dropdown
    class="quick-runtime"
    trigger="click"
    :hide-on-click="false"
    @command="handleCommand"
    @visible-change="visible => visible && load()"
  >
    <button class="quick-runtime__trigger" type="button">
      <span class="quick-runtime__label">{{ runtime?.providerName || '未识别 Provider' }}</span>
      <span class="quick-runtime__summary">{{ summaryLine }}</span>
    </button>

    <template #dropdown>
      <el-dropdown-menu class="quick-runtime__menu">
        <el-dropdown-item disabled>
          <span class="quick-runtime__menu-title">最近 Provider</span>
        </el-dropdown-item>
        <el-dropdown-item
          v-for="provider in recentProviders"
          :key="provider.id"
          :command="`provider:${provider.id}`"
          :disabled="provider.id === runtime?.managedProviderId || !!switchingId"
        >
          <span class="quick-runtime__item">
            <span>{{ provider.name }}</span>
            <small>{{ provider.defaultModel || '默认模型' }}</small>
            <small v-if="provider.id === runtime?.managedProviderId">当前</small>
            <small v-else-if="provider.id === switchingId">切换中…</small>
          </span>
        </el-dropdown-item>
        <el-dropdown-item v-if="!recentProviders.length" disabled>
          {{ loading ? '正在加载…' : '暂无 Provider' }}
        </el-dropdown-item>
        <el-dropdown-item divided command="manage">
          管理模型与账号
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped lang="scss">
.quick-runtime {
  display: block;
  width: 100%;
}

.quick-runtime__trigger {
  display: grid;
  width: 100%;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--ds-color-border-soft);
  border-radius: var(--ds-radius-control);
  background: rgb(255 255 255 / 42%);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.quick-runtime__trigger:hover {
  border-color: var(--ds-state-active-border);
  background: var(--ds-state-active-bg);
}

.quick-runtime__label,
.quick-runtime__summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-runtime__label {
  color: var(--ds-color-text);
  font-size: 12px;
  font-weight: 700;
}

.quick-runtime__summary {
  color: var(--ds-color-text-muted);
  font-size: 11px;
}

.quick-runtime__item {
  display: grid;
  min-width: 200px;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 12px;
  align-items: center;
}

.quick-runtime__item > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.quick-runtime__item small {
  color: var(--ds-color-text-muted);
  font-size: 11px;
}

.quick-runtime__menu-title {
  color: var(--ds-color-text-muted);
  font-size: 11px;
  font-weight: 700;
}
</style>

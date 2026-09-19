import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { AiProviderProfile, ProviderPreset, ProviderTestResponse, RuntimeSummary } from '@ai-manage/shared';
import { api } from '../../api';
import { selectedTool } from '../../state/app-state';
import { emptyProviderDraft, providerToDraft, type ProviderDraft } from './provider-view-model';

export function useProviders() {
  const providers = ref<AiProviderProfile[]>([]);
  const presets = ref<ProviderPreset[]>([]);
  const runtime = ref<RuntimeSummary>();
  const loading = ref(false);
  const saving = ref(false);
  const switchingId = ref('');
  const drawerVisible = ref(false);
  const draft = ref<ProviderDraft>(emptyProviderDraft(selectedTool.value));
  const editing = computed(() => !!draft.value.id);
  const testResult = ref<ProviderTestResponse>();
  const models = ref<string[]>([]);
  const modelLoading = ref(false);

  /** Reloads runtime, provider cards and presets for the selected tool. */
  async function load() {
    const tool = selectedTool.value;
    loading.value = true;
    try {
      const [nextProviders, nextPresets, nextRuntime] = await Promise.all([
        api.providers(tool), api.providerPresets(tool), api.runtime(tool),
      ]);
      if (selectedTool.value !== tool) return;
      providers.value = nextProviders;
      presets.value = nextPresets;
      runtime.value = nextRuntime;
    } finally { loading.value = false; }
  }

  /** Opens preset-first provider creation. */
  function openCreate() {
    draft.value = emptyProviderDraft(selectedTool.value);
    testResult.value = undefined;
    models.value = [];
    drawerVisible.value = true;
  }

  /** Opens provider editing with only a configured-secret indicator. */
  function openEdit(provider: AiProviderProfile) {
    draft.value = providerToDraft(provider);
    testResult.value = undefined;
    models.value = [];
    drawerVisible.value = true;
  }

  /** Applies a selected preset to the creation draft. */
  function applyPreset(id: string) {
    draft.value.presetId = id;
    const preset = presets.value.find(item => item.id === id);
    if (!preset) return;
    draft.value = {
      ...draft.value,
      name: preset.name, providerType: preset.providerType, endpoint: preset.endpoint || '',
      apiProtocol: preset.apiProtocol || '', defaultModel: preset.defaultModel || '',
      authMode: preset.authMode,
    };
  }

  /** Creates or updates one provider. API keys are sent only when explicitly entered. */
  async function save() {
    saving.value = true;
    try {
      const body = {
        tool: draft.value.tool, presetId: draft.value.presetId, name: draft.value.name,
        providerType: draft.value.providerType, endpoint: draft.value.endpoint,
        apiProtocol: draft.value.apiProtocol, defaultModel: draft.value.defaultModel,
        reasoningEffort: draft.value.reasoningEffort, authMode: draft.value.authMode,
        apiKey: draft.value.apiKey || undefined, removeCredential: draft.value.removeCredential,
      };
      if (draft.value.id) {
        await api.updateProvider(draft.value.id, body);
      } else {
        await api.createProvider(body);
      }
      drawerVisible.value = false;
      ElMessage.success('Provider 已保存');
      await load();
    } catch (error) { ElMessage.error(error instanceof Error ? error.message : String(error)); }
    finally { saving.value = false; }
  }

  /** Switches runtime through the transactional switch engine. */
  async function switchProvider(provider: AiProviderProfile) {
    switchingId.value = provider.id;
    try {
      const result = await api.switchProvider({ tool: provider.tool, providerId: provider.id });
      if (!result.success) throw new Error(`切换失败：${result.stage || 'unknown'}；回滚：${result.rolledBack ? '成功' : '未完成'}`);
      ElMessage.success(`已切换到 ${provider.name}`);
      await load();
    } catch (error) { ElMessage.error(error instanceof Error ? error.message : String(error)); }
    finally { switchingId.value = ''; }
  }

  /** Duplicates non-secret provider settings. */
  async function duplicate(provider: AiProviderProfile) {
    await api.duplicateProvider(provider.id);
    ElMessage.success('Provider 已复制，凭据未复制');
    await load();
  }

  /** Deletes one provider after explicit confirmation. */
  async function remove(provider: AiProviderProfile) {
    await ElMessageBox.confirm(`确定删除“${provider.name}”吗？`, '删除 Provider', { type: 'warning' });
    await api.deleteProvider(provider.id);
    ElMessage.success('Provider 已删除');
    await load();
  }

  /** Tests one saved provider and stores a structured result. */
  async function test(provider: AiProviderProfile) {
    testResult.value = await api.testProvider(provider.id);
    if (testResult.value.ok) ElMessage.success(testResult.value.message);
    else ElMessage.warning(testResult.value.message);
  }

  /** Fetches models from the current saved or unsaved draft. */
  async function fetchModels() {
    modelLoading.value = true;
    try {
      const response = draft.value.id
        ? await api.providerModels(draft.value.id)
        : await api.providerDraftModels({
            tool: draft.value.tool, presetId: draft.value.presetId, name: draft.value.name,
            providerType: draft.value.providerType, endpoint: draft.value.endpoint,
            apiProtocol: draft.value.apiProtocol, authMode: draft.value.authMode,
            apiKey: draft.value.apiKey || undefined,
          });
      models.value = response.models;
      if (!models.value.length) ElMessage.info('上游未返回可选模型');
    } catch (error) { ElMessage.error(error instanceof Error ? error.message : String(error)); }
    finally { modelLoading.value = false; }
  }

  /** Imports existing live provider state without modifying live files. */
  async function importLive() {
    const result = await api.importProviders({ tool: selectedTool.value });
    ElMessage.success(`已导入 ${result.imported.length} 个，跳过 ${result.skipped} 个`);
    await load();
  }

  watch(selectedTool, () => { drawerVisible.value = false; load(); }, { immediate: true });

  return {
    providers, presets, runtime, loading, saving, switchingId, drawerVisible, draft, editing,
    testResult, models, modelLoading, load, openCreate, openEdit, applyPreset, save,
    switchProvider, duplicate, remove, test, fetchModels, importLive,
  };
}

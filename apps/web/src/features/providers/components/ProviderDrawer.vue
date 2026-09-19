<script setup lang="ts">
import type { ManagedAccount, ProviderPreset } from '@ai-manage/shared';
import type { ProviderDraft } from '../provider-view-model';
import ProviderPresetPicker from './ProviderPresetPicker.vue';
import ModelPicker from './ModelPicker.vue';
import AuthBindingEditor from './AuthBindingEditor.vue';

const visible = defineModel<boolean>('visible', { required: true });
const draft = defineModel<ProviderDraft>('draft', { required: true });
defineProps<{
  presets: ProviderPreset[];
  accounts: ManagedAccount[];
  editing?: boolean;
  saving?: boolean;
  models: string[];
  modelLoading?: boolean;
}>();
defineEmits<{ save: []; selectPreset: [id: string]; fetchModels: []; addAccount: [] }>();
</script>

<template>
  <el-drawer v-model="visible" :title="editing ? '编辑 Provider' : '添加 Provider'" size="520px">
    <div class="form">
      <template v-if="!editing">
        <label>Preset</label>
        <ProviderPresetPicker v-model="draft.presetId" :presets="presets" @select="$emit('selectPreset', $event)" />
      </template>
      <label>名称</label><el-input v-model="draft.name" />
      <label>Provider 类型</label><el-input v-model="draft.providerType" />
      <label>Endpoint</label><el-input v-model="draft.endpoint" placeholder="https://..." />
      <label>协议</label><el-input v-model="draft.apiProtocol" />
      <label>认证</label>
      <AuthBindingEditor
        v-model="draft.authMode"
        :account-id="draft.accountId"
        :accounts="accounts"
        :allow-managed-account="draft.tool === 'codex'"
        :credential-configured="draft.credentialConfigured"
        @update:account-id="draft.accountId = $event"
        @add-account="$emit('addAccount')"
      />
      <template v-if="draft.authMode === 'api_key'">
        <label>API Key</label>
        <el-input v-model="draft.apiKey" type="password" show-password :placeholder="draft.credentialConfigured ? '已配置；留空保持不变' : '输入 API Key'" />
        <el-checkbox v-if="editing && draft.credentialConfigured" v-model="draft.removeCredential">移除现有凭据</el-checkbox>
      </template>
      <label>模型</label><ModelPicker v-model="draft.defaultModel" :models="models" :loading="modelLoading" @fetch="$emit('fetchModels')" />
      <label>推理强度</label>
      <el-select v-model="draft.reasoningEffort">
        <el-option label="低" value="low" />
        <el-option label="中" value="medium" />
        <el-option label="高" value="high" />
      </el-select>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="$emit('save')">保存</el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 10px; }
.form > label { margin-top: 6px; color: #606266; font-size: 13px; }
</style>

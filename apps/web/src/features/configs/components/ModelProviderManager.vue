<script setup lang="ts">
import { computed } from 'vue';
import { Close } from '@element-plus/icons-vue';
import type { ModelProviderCard, ModelProviderDrawerMode, ModelProviderForm } from '../use-configs';

const drawerVisible = defineModel<boolean>('drawerVisible', { required: true });
const draftKey = defineModel<string>('draftKey', { required: true });
const draftForm = defineModel<ModelProviderForm>('draftForm', { required: true });

const props = defineProps<{
  providers: ModelProviderCard[];
  activeKey: string;
  drawerMode: ModelProviderDrawerMode;
  savingSection: string;
}>();

const emit = defineEmits<{
  create: [];
  edit: [key: string];
  activate: [key: string];
  save: [];
  close: [];
}>();

const drawerTitle = computed(() => (
  props.drawerMode === 'create' ? '新建供应商' : `编辑供应商：${draftKey.value}`
));
const drawerSaving = computed(() => props.savingSection === 'model_provider:drawer');
const reasoningOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
];

function activateSectionId(key: string) {
  return `model_provider:${key}`;
}

function reasoningLabel(value: string) {
  return reasoningOptions.find(option => option.value === value)?.label || value || '未配置';
}

</script>

<template>
  <section class="provider-manager">
    <div class="provider-toolbar">
      <div>
        <h3>供应商配置</h3>
        <p v-if="activeKey">当前使用：{{ activeKey }}</p>
        <p v-else>当前未选择供应商</p>
      </div>
      <el-button type="primary" plain @click="emit('create')">
        新建供应商
      </el-button>
    </div>

    <div v-if="providers.length" class="provider-grid">
      <article
        v-for="provider in providers"
        :key="provider.key"
        class="provider-card"
        :class="{ 'provider-card--active': provider.active }"
      >
        <header class="provider-card__header">
          <div>
            <h4>{{ provider.name }}</h4>
            <span class="mono">{{ provider.key }}</span>
          </div>
          <el-tag v-if="provider.active" size="small" type="success">
            当前使用
          </el-tag>
        </header>

        <dl class="provider-summary">
          <div>
            <dt>接口地址</dt>
            <dd class="mono">{{ provider.baseUrl || '未配置' }}</dd>
          </div>
          <div>
            <dt>默认模型</dt>
            <dd>{{ provider.model || '未配置' }}</dd>
          </div>
          <div>
            <dt>推理强度</dt>
            <dd>{{ reasoningLabel(provider.reasoningEffort) }}</dd>
          </div>
        </dl>

        <footer class="provider-card__actions">
          <el-button size="small" @click="emit('edit', provider.key)">
            编辑
          </el-button>
          <el-button
            size="small"
            type="primary"
            :disabled="provider.active"
            :loading="savingSection === activateSectionId(provider.key)"
            @click="emit('activate', provider.key)"
          >
            激活
          </el-button>
        </footer>
      </article>
    </div>

    <el-empty v-else description="暂无供应商配置" />

    <el-drawer
      v-model="drawerVisible"
      class="provider-drawer"
      direction="rtl"
      size="52%"
      :with-header="false"
      @closed="emit('close')"
    >
      <section class="provider-drawer__content">
        <header class="provider-drawer__header">
          <div>
            <span>供应商</span>
            <h2>{{ drawerTitle }}</h2>
          </div>
          <el-button
            :icon="Close"
            circle
            title="关闭"
            @click="drawerVisible = false"
          />
        </header>

        <div class="provider-form">
          <div class="provider-field">
            <label>供应商标识</label>
            <el-input
              v-model="draftKey"
              :disabled="drawerMode === 'edit'"
              placeholder="例如 openai"
            />
          </div>
          <div class="provider-field">
            <label>供应商名称</label>
            <el-input v-model="draftForm.name" placeholder="例如 OpenAI" />
          </div>
          <div class="provider-field">
            <label>接口地址</label>
            <el-input v-model="draftForm.base_url" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="provider-field">
            <label>接口协议</label>
            <el-input v-model="draftForm.wire_api" placeholder="例如 responses" />
          </div>
          <div class="provider-field">
            <label>默认模型</label>
            <el-input v-model="draftForm.model" placeholder="例如 gpt-5.1-codex-max" />
          </div>
          <div class="provider-field">
            <label>推理强度</label>
            <el-select v-model="draftForm.model_reasoning_effort" class="full-control">
              <el-option
                v-for="option in reasoningOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>
          <div class="provider-field">
            <label>API Key 替换值</label>
            <el-input
              v-model="draftForm.openai_api_key"
              type="password"
              show-password
              placeholder="激活该供应商时写入对应配置"
            />
          </div>
        </div>

        <footer class="provider-drawer__footer">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="drawerSaving"
            @click="emit('save')"
          >
            保存供应商
          </el-button>
        </footer>
      </section>
    </el-drawer>
  </section>
</template>

<style scoped lang="scss">
.provider-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 0;
}

.provider-toolbar h3 {
  margin: 0;
  font-size: 15px;
}

.provider-toolbar p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 12px;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.provider-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.provider-card--active {
  border-color: #67c23a;
  box-shadow: inset 3px 0 0 #67c23a;
}

.provider-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.provider-card__header h4 {
  margin: 0 0 4px;
  color: #1f2937;
  font-size: 15px;
}

.provider-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.provider-summary div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.provider-summary dt {
  color: #6b7280;
  font-size: 12px;
}

.provider-summary dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: #1f2937;
  font-size: 12px;
}

.provider-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
}

.provider-drawer :deep(.el-drawer__body) {
  padding: 0;
}

.provider-drawer__content {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #f8fafc;
}

.provider-drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.provider-drawer__header span {
  color: #909399;
  font-size: 12px;
  text-transform: uppercase;
}

.provider-drawer__header h2 {
  margin: 4px 0 0;
  font-size: 20px;
}

.provider-form {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
  padding: 18px 22px 90px;
  overflow: auto;
}

.provider-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.provider-field label {
  color: #606266;
  font-size: 14px;
  line-height: 1.35;
}

.provider-field :deep(.el-input),
.provider-field :deep(.el-select) {
  width: 100%;
}

.full-control {
  width: 100%;
}

.provider-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
}
</style>

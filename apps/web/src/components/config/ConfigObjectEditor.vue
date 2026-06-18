<template>
  <div class="config-object-editor">
    <template v-if="isRecordValue">
      <div v-if="!entries.length" class="empty-object">暂无字段</div>
      <div v-for="entry in entries" :key="entry.key" class="object-row">
        <div class="row-label">
          <div class="field-title-line">
            <span class="field-name">{{ metaFor(entry.key).label }}</span>
            <el-tag size="small" type="info">{{ valueType(entry.value) }}</el-tag>
          </div>
          <p v-if="metaFor(entry.key).description" class="field-description">
            {{ metaFor(entry.key).description }}
          </p>
          <span class="field-key">{{ entry.key }}</span>
        </div>
        <div class="row-control">
          <ConfigObjectEditor
            v-if="isEditableObject(entry.value)"
            :model-value="entry.value"
            :path="[...path, entry.key]"
            :field-meta="fieldMeta"
            @update:model-value="updateKey(entry.key, $event)"
          />
          <el-switch
            v-else-if="typeof entry.value === 'boolean'"
            :model-value="entry.value"
            @update:model-value="updateKey(entry.key, $event)"
          />
          <el-input-number
            v-else-if="typeof entry.value === 'number'"
            :model-value="entry.value"
            controls-position="right"
            @update:model-value="updateKey(entry.key, $event ?? 0)"
          />
          <el-select
            v-else-if="metaFor(entry.key).options?.length"
            :model-value="formatScalar(entry.value)"
            class="value-select"
            @update:model-value="updateKey(entry.key, $event)"
          >
            <el-option
              v-for="option in metaFor(entry.key).options"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-select
            v-else-if="isPrimitiveArray(entry.value)"
            :model-value="entry.value.map(item => String(item))"
            multiple
            filterable
            allow-create
            default-first-option
            class="array-select"
            @update:model-value="updateKey(entry.key, $event)"
          />
          <el-input
            v-else
            :model-value="formatScalar(entry.value)"
            @update:model-value="updateKey(entry.key, $event)"
          />
        </div>
        <el-button text type="danger" @click="removeKey(entry.key)">删除</el-button>
      </div>
      <div class="add-row">
        <el-input v-model="newKey" placeholder="新增字段名" />
        <el-select v-model="newType" class="type-select">
          <el-option label="文本" value="string" />
          <el-option label="开关" value="boolean" />
          <el-option label="数字" value="number" />
          <el-option label="列表" value="array" />
          <el-option label="对象" value="object" />
        </el-select>
        <el-button :disabled="!newKey.trim()" @click="addKey">添加</el-button>
      </div>
    </template>
    <template v-else-if="isPrimitiveArray(modelValue)">
      <el-select
        :model-value="modelValue.map(item => String(item))"
        multiple
        filterable
        allow-create
        default-first-option
        class="array-select"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </template>
    <el-input
      v-else
      :model-value="formatScalar(modelValue)"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

defineOptions({ name: 'ConfigObjectEditor' });

const props = defineProps<{
  modelValue: unknown;
  path?: string[];
  fieldMeta?: (path: string[], key: string) => FieldMeta;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: unknown];
}>();

const newKey = ref('');
const newType = ref<'string' | 'boolean' | 'number' | 'array' | 'object'>('string');
const path = computed(() => props.path || []);

const isRecordValue = computed(() => isRecord(props.modelValue));
const entries = computed(() => Object.entries(isRecord(props.modelValue) ? props.modelValue : {})
  .map(([key, value]) => ({ key, value })));

function updateKey(key: string, value: unknown) {
  emit('update:modelValue', {
    ...(isRecord(props.modelValue) ? props.modelValue : {}),
    [key]: value,
  });
}

function removeKey(key: string) {
  const next = { ...(isRecord(props.modelValue) ? props.modelValue : {}) };
  delete next[key];
  emit('update:modelValue', next);
}

function addKey() {
  const key = newKey.value.trim();
  if (!key) return;
  updateKey(key, defaultValue(newType.value));
  newKey.value = '';
  newType.value = 'string';
}

function defaultValue(type: typeof newType.value) {
  if (type === 'boolean') return false;
  if (type === 'number') return 0;
  if (type === 'array') return [];
  if (type === 'object') return {};
  return '';
}

interface FieldMeta {
  label: string;
  description?: string;
  options?: Array<{ label: string; value: string }>;
}

function metaFor(key: string): FieldMeta {
  return props.fieldMeta?.(path.value, key) || { label: key };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isEditableObject(value: unknown) {
  return isRecord(value);
}

function isPrimitiveArray(value: unknown): value is Array<string | number | boolean> {
  return Array.isArray(value) && value.every(item => ['string', 'number', 'boolean'].includes(typeof item));
}

function valueType(value: unknown) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function formatScalar(value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}
</script>

<style scoped>
.config-object-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.object-row {
  display: grid;
  grid-template-columns: minmax(210px, 280px) minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  padding: 12px 0;
  border-bottom: 1px solid #eef0f4;
}

.row-label {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 32px;
  min-width: 0;
}

.field-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.field-name {
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
}

.field-description {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.45;
}

.field-key {
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  color: #9ca3af;
}

.row-control {
  min-width: 0;
}

.array-select,
.value-select {
  width: 100%;
}

.add-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 120px auto;
  gap: 8px;
  align-items: center;
  padding-top: 8px;
}

.type-select {
  width: 120px;
}

.empty-object {
  color: #909399;
  font-size: 13px;
}
</style>

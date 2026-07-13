<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue';
import type { AiTool } from '@ai-manage/shared';
import { computed } from 'vue';
import type { McpServerDraft } from '../use-mcp-servers';

const props = defineProps<{
  /** Normalized MCP server form data. */
  modelValue: McpServerDraft;
  /** Tool whose native configuration will receive the server. */
  tool: AiTool;
  /** Prevents renaming an existing configuration key. */
  nameReadonly?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: McpServerDraft];
}>();

const transportOptions = [
  { label: 'STDIO', value: 'stdio' },
  { label: '流式 HTTP', value: 'http' },
];
const isCodex = computed(() => props.tool === 'codex');

/** Replaces one top-level field while keeping form updates immutable. */
function updateField<K extends keyof McpServerDraft>(key: K, value: McpServerDraft[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

/** Adds an empty item to a list field. */
function addListItem(key: 'args' | 'envVars') {
  updateField(key, [...props.modelValue[key], '']);
}

/** Updates one list item. */
function updateListItem(key: 'args' | 'envVars', index: number, value: string) {
  const next = [...props.modelValue[key]];
  next[index] = value;
  updateField(key, next);
}

/** Removes one list item. */
function removeListItem(key: 'args' | 'envVars', index: number) {
  updateField(key, props.modelValue[key].filter((_, itemIndex) => itemIndex !== index));
}

/** Adds a blank key-value row using a collision-free temporary key. */
function addRecordItem(key: 'env' | 'headers' | 'envHeaders') {
  const source = props.modelValue[key];
  let newKey = '';
  let suffix = 1;
  while (Object.prototype.hasOwnProperty.call(source, newKey)) newKey = `NEW_KEY_${suffix++}`;
  updateField(key, { ...source, [newKey]: '' });
}

/** Renames a key-value row without mutating the current model. */
function renameRecordItem(key: 'env' | 'headers' | 'envHeaders', oldKey: string, newKey: string) {
  const entries = Object.entries(props.modelValue[key]).map(([itemKey, value]) => [itemKey === oldKey ? newKey : itemKey, value]);
  updateField(key, Object.fromEntries(entries));
}

/** Updates a key-value row value. */
function updateRecordValue(key: 'env' | 'headers' | 'envHeaders', itemKey: string, value: string) {
  updateField(key, { ...props.modelValue[key], [itemKey]: value });
}

/** Removes a key-value row. */
function removeRecordItem(key: 'env' | 'headers' | 'envHeaders', itemKey: string) {
  updateField(key, Object.fromEntries(Object.entries(props.modelValue[key]).filter(([keyName]) => keyName !== itemKey)));
}
</script>

<template>
  <el-form class="mcp-form" label-position="top">
    <section class="mcp-form__section">
      <div class="mcp-form__control">
        <strong>名称</strong>
        <el-input
          :model-value="modelValue.name"
          :readonly="nameReadonly"
          placeholder="MCP server name"
          @update:model-value="updateField('name', $event)"
        />
      </div>
      <div class="mcp-form__transport">
        <strong>类型</strong>
        <el-segmented
          :model-value="modelValue.transport"
          :options="transportOptions"
          @update:model-value="updateField('transport', $event as McpServerDraft['transport'])"
        />
      </div>
    </section>

    <section v-if="modelValue.transport === 'stdio'" class="mcp-form__section">
      <div class="mcp-form__control">
        <strong>启动命令</strong>
        <el-input :model-value="modelValue.command" placeholder="npx -y @example/mcp-server" @update:model-value="updateField('command', $event)" />
      </div>

      <div class="mcp-form__field">
        <strong>参数</strong>
        <div v-for="(arg, index) in modelValue.args" :key="`arg-${index}`" class="mcp-form__row mcp-form__row--single">
          <el-input :model-value="arg" placeholder="命令参数" @update:model-value="updateListItem('args', index, $event)" />
          <el-button :icon="Delete" text type="danger" title="删除参数" @click="removeListItem('args', index)" />
        </div>
        <el-button class="mcp-form__add" :icon="Plus" @click="addListItem('args')">添加参数</el-button>
      </div>

      <div class="mcp-form__field">
        <strong>环境变量</strong>
        <div v-for="(value, key) in modelValue.env" :key="key" class="mcp-form__row">
          <el-input :model-value="key" placeholder="键" @change="renameRecordItem('env', key, String($event))" />
          <el-input :model-value="value" placeholder="值" @update:model-value="updateRecordValue('env', key, $event)" />
          <el-button :icon="Delete" text type="danger" title="删除环境变量" @click="removeRecordItem('env', key)" />
        </div>
        <el-button class="mcp-form__add" :icon="Plus" @click="addRecordItem('env')">添加环境变量</el-button>
      </div>

      <div v-if="isCodex" class="mcp-form__field">
        <strong>环境变量传递</strong>
        <div v-for="(variable, index) in modelValue.envVars" :key="`env-var-${index}`" class="mcp-form__row mcp-form__row--single">
          <el-input :model-value="variable" placeholder="环境变量名称" @update:model-value="updateListItem('envVars', index, $event)" />
          <el-button :icon="Delete" text type="danger" title="删除变量" @click="removeListItem('envVars', index)" />
        </div>
        <el-button class="mcp-form__add" :icon="Plus" @click="addListItem('envVars')">添加变量</el-button>
      </div>

      <div class="mcp-form__control">
        <strong>工作目录</strong>
        <el-input :model-value="modelValue.cwd" placeholder="~/code" @update:model-value="updateField('cwd', $event)" />
      </div>
    </section>

    <section v-else class="mcp-form__section">
      <div class="mcp-form__control">
        <strong>URL</strong>
        <el-input :model-value="modelValue.url" placeholder="https://mcp.example.com/mcp" @update:model-value="updateField('url', $event)" />
      </div>
      <div v-if="isCodex" class="mcp-form__control mcp-form__control--separated">
        <strong>Bearer 令牌环境变量</strong>
        <el-input :model-value="modelValue.bearerTokenEnvVar" placeholder="MCP_BEARER_TOKEN" @update:model-value="updateField('bearerTokenEnvVar', $event)" />
      </div>

      <div class="mcp-form__field">
        <strong>标头</strong>
        <div v-for="(value, key) in modelValue.headers" :key="key" class="mcp-form__row">
          <el-input :model-value="key" placeholder="键" @change="renameRecordItem('headers', key, String($event))" />
          <el-input :model-value="value" placeholder="值" @update:model-value="updateRecordValue('headers', key, $event)" />
          <el-button :icon="Delete" text type="danger" title="删除标头" @click="removeRecordItem('headers', key)" />
        </div>
        <el-button class="mcp-form__add" :icon="Plus" @click="addRecordItem('headers')">添加标头</el-button>
      </div>

      <div v-if="isCodex" class="mcp-form__field">
        <strong>来自环境变量的标头</strong>
        <div v-for="(value, key) in modelValue.envHeaders" :key="key" class="mcp-form__row">
          <el-input :model-value="key" placeholder="标头名称" @change="renameRecordItem('envHeaders', key, String($event))" />
          <el-input :model-value="value" placeholder="环境变量名称" @update:model-value="updateRecordValue('envHeaders', key, $event)" />
          <el-button :icon="Delete" text type="danger" title="删除变量标头" @click="removeRecordItem('envHeaders', key)" />
        </div>
        <el-button class="mcp-form__add" :icon="Plus" @click="addRecordItem('envHeaders')">添加变量</el-button>
      </div>
    </section>
  </el-form>
</template>

<style scoped lang="scss">
.mcp-form { display: grid; gap: 12px; }
.mcp-form__section { display: grid; gap: 16px; padding: 16px; border: 1px solid var(--ds-color-border-soft); border-radius: var(--ds-radius-panel); }
.mcp-form__control { display: grid; gap: 10px; }
.mcp-form__control--separated { padding-top: 14px; border-top: 1px solid var(--ds-color-border-soft); }
.mcp-form__transport { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 14px; border-top: 1px solid var(--ds-color-border-soft); }
.mcp-form__field { display: grid; gap: 10px; padding-top: 14px; border-top: 1px solid var(--ds-color-border-soft); }
.mcp-form__row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 32px; gap: 8px; align-items: center; }
.mcp-form__row--single { grid-template-columns: minmax(0, 1fr) 32px; }
.mcp-form__add { width: 100%; }
</style>

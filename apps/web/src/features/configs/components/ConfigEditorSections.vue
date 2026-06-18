<script setup lang="ts">
import type { ConfigFileDetail } from '@ai-manage/shared';
import ConfigObjectEditor from '../../../components/config/ConfigObjectEditor.vue';
import type { ConfigGroupItemEntry, ConfigMenuItem, FieldMeta } from '../use-configs';

const draftRaw = defineModel<string>('draftRaw', { required: true });

defineProps<{
  selectedConfig: ConfigFileDetail;
  selectedMenuItem: ConfigMenuItem;
  savingSection: string;
  markdownInputStyle: Record<string, string>;
  markdownDirty: boolean;
  rootDirty: boolean;
  rootFields: Record<string, unknown>;
  draftRecord: Record<string, unknown>;
  fieldPath: (section: string) => string[];
  configFieldMeta: (path: string[], key: string) => FieldMeta;
  shouldSplitGroup: (key: string) => boolean;
  groupItemEntries: (groupKey: string) => ConfigGroupItemEntry[];
  itemLabel: (groupKey: string, itemKey: string) => string;
  itemDescription: (groupKey: string, itemKey: string) => string;
  isGroupItemDirty: (groupKey: string, itemKey: string) => boolean;
  sectionId: (groupKey: string, itemKey: string) => string;
  isGroupDirty: (key: string) => boolean;
}>();

const emit = defineEmits<{
  saveMarkdown: [];
  saveRoot: [];
  updateRootFields: [value: unknown];
  saveGroupItem: [groupKey: string, itemKey: string];
  updateGroupItem: [groupKey: string, itemKey: string, value: unknown];
  saveGroup: [key: string];
  updateGroup: [key: string, value: unknown];
}>();
</script>

<template>
  <div class="form-scroll">
    <template v-if="selectedMenuItem.section === 'markdown'">
      <section class="config-section-card">
        <div class="section-heading">
          <div>
            <h3>{{ selectedMenuItem.label }}</h3>
            <p>{{ selectedMenuItem.description }}</p>
          </div>
          <div class="section-actions">
            <span>Markdown</span>
            <el-button
              size="small"
              type="primary"
              :disabled="!markdownDirty"
              :loading="savingSection === 'markdown'"
              @click="emit('saveMarkdown')"
            >
              保存本板块
            </el-button>
          </div>
        </div>
        <el-input
          v-model="draftRaw"
          type="textarea"
          resize="none"
          class="markdown-editor"
          :rows="22"
          :input-style="markdownInputStyle"
        />
      </section>
    </template>

    <section v-else-if="selectedMenuItem.section === 'root'" class="config-section-card">
      <div class="section-heading">
        <div>
          <h3>{{ selectedMenuItem.label }}</h3>
          <p>{{ selectedMenuItem.description }}</p>
        </div>
        <div class="section-actions">
          <span>{{ selectedConfig.formKind === 'toml-config' ? 'TOML' : 'JSON' }}</span>
          <el-button
            size="small"
            type="primary"
            :disabled="!rootDirty"
            :loading="savingSection === 'root'"
            @click="emit('saveRoot')"
          >
            保存本板块
          </el-button>
        </div>
      </div>
      <ConfigObjectEditor
        :model-value="rootFields"
        :path="fieldPath('root')"
        :field-meta="configFieldMeta"
        @update:model-value="emit('updateRootFields', $event)"
      />
    </section>

    <template v-else-if="selectedMenuItem.key && shouldSplitGroup(selectedMenuItem.key)">
      <section
        v-for="entry in groupItemEntries(selectedMenuItem.key)"
        :key="entry.key"
        class="config-section-card"
      >
        <div class="section-heading">
          <div>
            <h3>{{ itemLabel(selectedMenuItem.key, entry.key) }}</h3>
            <p>{{ itemDescription(selectedMenuItem.key, entry.key) }}</p>
          </div>
          <div class="section-actions">
            <span class="mono">{{ entry.key }}</span>
            <el-button
              size="small"
              type="primary"
              :disabled="!isGroupItemDirty(selectedMenuItem.key, entry.key)"
              :loading="savingSection === sectionId(selectedMenuItem.key, entry.key)"
              @click="emit('saveGroupItem', selectedMenuItem.key, entry.key)"
            >
              保存本项
            </el-button>
          </div>
        </div>
        <ConfigObjectEditor
          :model-value="entry.value"
          :path="[...fieldPath(selectedMenuItem.key), entry.key]"
          :field-meta="configFieldMeta"
          @update:model-value="emit('updateGroupItem', selectedMenuItem.key!, entry.key, $event)"
        />
      </section>
    </template>

    <section v-else-if="selectedMenuItem.key" class="config-section-card">
      <div class="section-heading">
        <div>
          <h3>{{ selectedMenuItem.label }}</h3>
          <p>{{ selectedMenuItem.description }}</p>
        </div>
        <div class="section-actions">
          <span class="mono">{{ selectedMenuItem.key }}</span>
          <el-button
            size="small"
            type="primary"
            :disabled="!isGroupDirty(selectedMenuItem.key)"
            :loading="savingSection === selectedMenuItem.key"
            @click="emit('saveGroup', selectedMenuItem.key)"
          >
            保存本板块
          </el-button>
        </div>
      </div>
      <ConfigObjectEditor
        :model-value="draftRecord[selectedMenuItem.key]"
        :path="fieldPath(selectedMenuItem.key)"
        :field-meta="configFieldMeta"
        @update:model-value="emit('updateGroup', selectedMenuItem.key!, $event)"
      />
    </section>
  </div>
</template>

<style scoped lang="scss">
.form-scroll {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
}

.config-section-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-heading h3 {
  margin: 0;
  font-size: 15px;
}

.section-heading p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 12px;
}

.section-heading span {
  color: #909399;
  font-size: 12px;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.markdown-editor :deep(.el-textarea__inner) {
  height: 560px !important;
  min-height: 560px !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}
</style>

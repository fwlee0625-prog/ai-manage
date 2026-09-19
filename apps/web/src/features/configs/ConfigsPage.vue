<script setup lang="ts">
import { DsPanel, DsSplitView } from '../../components/design-system';
import ConfigDetailHeader from './components/ConfigDetailHeader.vue';
import ConfigEditorSections from './components/ConfigEditorSections.vue';
import ConfigMenuPanel from './components/ConfigMenuPanel.vue';
import { useConfigs } from './use-configs';

const {
  selectedMenuId,
  menuItems,
  selectedMenuItem,
  isDirty,
  selectedConfig,
  draftRaw,
  savingSection,
  loadingDetail,
  markdownInputStyle,
  markdownDirty,
  rootDirty,
  rootFields,
  draftRecord,
  selectMenu,
  resetDraft,
  reloadSelected,
  saveMarkdownSection,
  saveRootSection,
  fieldPath,
  configFieldMeta,
  updateRootFields,
  shouldSplitGroup,
  groupItemEntries,
  itemLabel,
  itemDescription,
  isGroupItemDirty,
  sectionId,
  saveGroupItemSection,
  toggleGroupItemSection,
  updateGroupItem,
  isGroupDirty,
  saveGroupSection,
  updateGroup,
} = useConfigs();
</script>

<template>
  <section class="config-page">
    <DsSplitView left-width="300px">
      <template #left>
        <ConfigMenuPanel
          :selected-menu-id="selectedMenuId"
          :menu-items="menuItems"
          @select="selectMenu"
        />
      </template>

      <DsPanel fill class="config-detail">
        <template #header>
          <ConfigDetailHeader
            :label="selectedMenuItem?.label || '选择配置项'"
            :is-dirty="isDirty"
            :has-selected-config="!!selectedConfig"
            :loading-detail="loadingDetail"
            @reset="resetDraft"
            @reload="reloadSelected"
          />
        </template>

        <div v-if="selectedConfig && selectedMenuItem" class="config-editor">
          <ConfigEditorSections
            v-model:draft-raw="draftRaw"
            :selected-config="selectedConfig"
            :selected-menu-item="selectedMenuItem"
            :saving-section="savingSection"
            :markdown-input-style="markdownInputStyle"
            :markdown-dirty="markdownDirty"
            :root-dirty="rootDirty"
            :root-fields="rootFields"
            :draft-record="draftRecord"
            :field-path="fieldPath"
            :config-field-meta="configFieldMeta"
            :should-split-group="shouldSplitGroup"
            :group-item-entries="groupItemEntries"
            :item-label="itemLabel"
            :item-description="itemDescription"
            :is-group-item-dirty="isGroupItemDirty"
            :section-id="sectionId"
            :is-group-dirty="isGroupDirty"
            @save-markdown="saveMarkdownSection"
            @save-root="saveRootSection"
            @update-root-fields="updateRootFields"
            @save-group-item="saveGroupItemSection"
            @toggle-group-item="toggleGroupItemSection"
            @update-group-item="updateGroupItem"
            @save-group="saveGroupSection"
            @update-group="updateGroup"
          />
        </div>

        <el-empty v-else description="请选择左侧配置项" />
      </DsPanel>
    </DsSplitView>
  </section>
</template>

<style scoped lang="scss">
.config-page {
  min-height: 0;
}

.config-editor {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
}
</style>

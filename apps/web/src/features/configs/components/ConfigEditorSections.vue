<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import type { ConfigFileDetail } from "@ai-manage/shared";
import ConfigObjectEditor from "../../../components/config/ConfigObjectEditor.vue";
import type {
  ConfigGroupItemEntry,
  ConfigMenuItem,
  FieldMeta,
} from "../use-configs";

const draftRaw = defineModel<string>("draftRaw", { required: true });
const props = defineProps<{
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

const hasRootFields = computed(() => Object.keys(props.rootFields).length > 0);
const isModelRootSection = computed(
  () => props.selectedMenuItem.rootKind === "model",
);
const selectedGroupKey = computed(() => props.selectedMenuItem.key || "");
const groupItemDrawerVisible = shallowRef(false);
const groupItemDrawerKey = shallowRef("");
const activeGroupItemEntry = computed(() =>
  selectedGroupKey.value
    ? props
        .groupItemEntries(selectedGroupKey.value)
        .find((entry) => entry.key === groupItemDrawerKey.value)
    : undefined,
);
const activeGroupItemTitle = computed(() =>
  activeGroupItemEntry.value && selectedGroupKey.value
    ? props.itemLabel(selectedGroupKey.value, activeGroupItemEntry.value.key)
    : "配置详情",
);
const activeGroupItemDescription = computed(() =>
  activeGroupItemEntry.value && selectedGroupKey.value
    ? props.itemDescription(
        selectedGroupKey.value,
        activeGroupItemEntry.value.key,
      )
    : "",
);

interface SummaryLine {
  label: string;
  value: string;
}

/**
 * Returns compact Chinese summary lines for card-style config groups.
 */
function groupItemSummary(
  groupKey: string,
  entry: ConfigGroupItemEntry,
): SummaryLine[] {
  const value = isRecord(entry.value) ? entry.value : {};
  if (groupKey === "projects") {
    return [
      summaryLine("项目路径", entry.key),
      summaryLine("信任级别", trustLevelLabel(value.trust_level)),
    ].filter(isSummaryLine);
  }
  if (groupKey === "marketplaces" || groupKey === "extraKnownMarketplaces") {
    return [
      summaryLine("类型", scalar(value.type) || "未配置"),
      summaryLine(
        "地址",
        scalar(value.url || value.source || value.path) || "未配置",
      ),
    ].filter(isSummaryLine);
  }
  if (groupKey === "plugins" || groupKey === "enabledPlugins") {
    return [summaryLine("插件标识", entry.key)].filter(isSummaryLine);
  }
  return [summaryLine("字段数量", `${Object.keys(value).length} 项`)].filter(
    isSummaryLine,
  );
}

function summaryLine(label: string, value: string) {
  return value ? { label, value } : undefined;
}

function isSummaryLine(line: SummaryLine | undefined): line is SummaryLine {
  return !!line;
}

function trustLevelLabel(value: unknown) {
  if (value === "trusted") return "可信任";
  if (value === "untrusted") return "不信任";
  return scalar(value) || "未配置";
}

function scalar(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isBooleanOnlyGroupItem(value: unknown) {
  if (typeof value === "boolean") return true;
  return isRecord(value) && typeof value.enabled === "boolean";
}

function groupItemSwitchValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (isRecord(value) && typeof value.enabled === "boolean")
    return value.enabled;
  return false;
}

function openGroupItemDrawer(key: string) {
  groupItemDrawerKey.value = key;
  groupItemDrawerVisible.value = true;
}

function closeGroupItemDrawer() {
  groupItemDrawerVisible.value = false;
}

watch(
  () => props.selectedMenuItem.id,
  () => {
    groupItemDrawerVisible.value = false;
    groupItemDrawerKey.value = "";
  },
);

const emit = defineEmits<{
  saveMarkdown: [];
  saveRoot: [];
  updateRootFields: [value: unknown];
  saveGroupItem: [groupKey: string, itemKey: string];
  toggleGroupItem: [groupKey: string, itemKey: string, enabled: boolean];
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

    <template v-else-if="selectedMenuItem.section === 'root'">
      <section v-if="hasRootFields" class="config-section-card">
        <div class="section-heading">
          <div>
            <h3>{{ selectedMenuItem.label }}</h3>
            <p>{{ selectedMenuItem.description }}</p>
          </div>
          <div class="section-actions">
            <span>{{
              selectedConfig.formKind === "toml-config" ? "TOML" : "JSON"
            }}</span>
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

      <section v-if="isModelRootSection" class="config-section-card">
        <div class="section-heading">
          <div>
            <h3>模型与账号已迁移</h3>
            <p>Provider、API Key、账号绑定与运行环境切换由独立模块统一管理。</p>
          </div>
          <router-link to="/providers"><el-button type="primary" plain>前往模型与账号</el-button></router-link>
        </div>
      </section>
    </template>

    <template
      v-else-if="selectedMenuItem.key && shouldSplitGroup(selectedMenuItem.key)"
    >
      <div class="item-card-grid">
        <article
          v-for="entry in groupItemEntries(selectedMenuItem.key)"
          :key="entry.key"
          class="config-item-card"
          role="button"
          tabindex="0"
          @click="openGroupItemDrawer(entry.key)"
          @keydown.enter.prevent="openGroupItemDrawer(entry.key)"
        >
          <div class="item-card-header">
            <div class="item-card-title">
              <h3>{{ itemLabel(selectedMenuItem.key, entry.key) }}</h3>
              <!-- <p>{{ itemDescription(selectedMenuItem.key, entry.key) }}</p> -->
            </div>
            <div class="item-card-controls" @click.stop>
              <el-tag
                v-if="isGroupItemDirty(selectedMenuItem.key, entry.key)"
                size="small"
                type="warning"
              >
                未保存
              </el-tag>
            </div>
          </div>

          <dl class="item-card-summary">
            <div
              v-for="line in groupItemSummary(selectedGroupKey, entry)"
              :key="line.label"
            >
              <dt>{{ line.label }}</dt>
              <dd
                :class="{
                  mono:
                    line.label.includes('路径') ||
                    line.label.includes('标识') ||
                    line.label === '地址',
                }"
              >
                {{ line.value }}
              </dd>
            </div>
            <div
              v-if="isBooleanOnlyGroupItem(entry.value)"
              class="item-card-summary__switch"
            >
              <dt>状态</dt>
              <dd @click.stop>
                <el-switch
                  :model-value="groupItemSwitchValue(entry.value)"
                  :disabled="
                    savingSection === sectionId(selectedMenuItem.key, entry.key)
                  "
                  @update:model-value="
                    emit(
                      'toggleGroupItem',
                      selectedMenuItem.key!,
                      entry.key,
                      Boolean($event),
                    )
                  "
                />
              </dd>
            </div>
          </dl>

          <footer class="item-card-actions">
            <el-button
              size="small"
              @click.stop="openGroupItemDrawer(entry.key)"
            >
              详情
            </el-button>
          </footer>
        </article>
      </div>

      <el-drawer
        v-model="groupItemDrawerVisible"
        direction="rtl"
        size="52%"
        :title="activeGroupItemTitle"
      >
        <section
          v-if="activeGroupItemEntry && selectedGroupKey"
          class="group-item-detail"
        >
          <header class="group-item-detail__header">
            <p>{{ activeGroupItemDescription }}</p>
            <span class="mono">{{ activeGroupItemEntry.key }}</span>
          </header>
          <ConfigObjectEditor
            :model-value="activeGroupItemEntry.value"
            :path="[...fieldPath(selectedGroupKey), activeGroupItemEntry.key]"
            :field-meta="configFieldMeta"
            @update:model-value="
              emit(
                'updateGroupItem',
                selectedGroupKey,
                activeGroupItemEntry.key,
                $event,
              )
            "
          />
        </section>
        <template #footer>
          <div class="drawer-footer">
            <el-button @click="closeGroupItemDrawer">关闭</el-button>
            <el-button
              v-if="activeGroupItemEntry && selectedGroupKey"
              type="primary"
              :disabled="
                !isGroupItemDirty(selectedGroupKey, activeGroupItemEntry.key)
              "
              :loading="
                savingSection ===
                sectionId(selectedGroupKey, activeGroupItemEntry.key)
              "
              @click="
                emit(
                  'saveGroupItem',
                  selectedGroupKey,
                  activeGroupItemEntry.key,
                )
              "
            >
              保存本项
            </el-button>
          </div>
        </template>
      </el-drawer>
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

.item-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.config-item-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.16s ease;
}

.config-item-card:hover,
.config-item-card:focus-visible {
  border-color: #409eff;
  outline: none;
}

.item-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.item-card-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.item-card-title {
  min-width: 0;
}

.item-card-title h3 {
  margin: 0;
  color: #1f2937;
  font-size: 15px;
}

.item-card-title p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.45;
}

.item-card-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.item-card-summary > div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
}

.item-card-summary dt {
  color: #6b7280;
  font-size: 12px;
}

.item-card-summary dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: #1f2937;
  font-size: 12px;
}

.item-card-summary__switch {
  display: flex;
  align-items: center;
  dd {
    justify-content: flex-start;
  }
}
.item-card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
}

.group-item-detail {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.group-item-detail__header {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.group-item-detail__header p {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.markdown-editor :deep(.el-textarea__inner) {
  height: 560px !important;
  min-height: 560px !important;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    monospace;
}
</style>

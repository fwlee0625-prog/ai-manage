<script setup lang="ts">
import { computed } from 'vue';
import { DsPanel, DsSplitView } from '../../../components/design-system';
import StatChart from './StatChart.vue';
import ProjectUsageList from './ProjectUsageList.vue';
import SessionUsageTable from './SessionUsageTable.vue';
import { useProjectUsage } from '../use-project-usage';
import { TREND_RANGE_OPTIONS } from '../usage-chart-options';

/**
 * 项目作用域视图：左右布局，左侧项目用量列表，右侧为选中项目的
 * 趋势 / 工具调用分布小图与该项目的会话明细。数据由 {@link useProjectUsage} 自行加载。
 */
const {
  projects,
  sessions,
  selectedProjectPath,
  selectedProject,
  trendDays,
  loadingSessions,
  trendOption,
  toolCallOption,
  selectProject,
} = useProjectUsage();

const sessionPanelTitle = computed(() =>
  selectedProject.value ? `会话明细 · ${selectedProject.value.projectName}` : '会话明细',
);

const sessionPanelDescription = computed(() =>
  selectedProject.value
    ? `共 ${sessions.total} 条会话；模型列展示该会话使用过的全部模型`
    : '在左侧选择项目，查看每个会话的用量明细',
);
</script>

<template>
  <div class="project-usage-view">
    <div class="project-usage-view__explorer">
      <DsSplitView left-width="34%">
        <template #left>
          <DsPanel
            fill
            compact
            plain
            title="项目用量"
            description="按总 Token 降序；点击选择项目"
          >
            <ProjectUsageList
              :projects="projects"
              :selected-project-path="selectedProjectPath"
              @select="selectProject"
            />
          </DsPanel>
        </template>
        <div class="project-usage-view__detail">
          <div v-if="selectedProject" class="project-usage-view__charts">
            <DsPanel
              compact
              title="按日 Token 趋势"
              :description="`仅统计「${selectedProject.projectName}」`"
            >
              <template #actions>
                <el-radio-group v-model="trendDays" size="small">
                  <el-radio-button v-for="days in TREND_RANGE_OPTIONS" :key="days" :value="days">
                    {{ days }} 天
                  </el-radio-button>
                </el-radio-group>
              </template>
              <StatChart :option="trendOption" height="220px" />
            </DsPanel>
            <DsPanel
              compact
              title="工具调用分布"
              :description="`仅统计「${selectedProject.projectName}」`"
            >
              <StatChart :option="toolCallOption" height="220px" />
            </DsPanel>
          </div>
          <DsPanel fill compact :title="sessionPanelTitle" :description="sessionPanelDescription">
            <SessionUsageTable :sessions="sessions.items" :loading="loadingSessions" />
          </DsPanel>
        </div>
      </DsSplitView>
    </div>
  </div>
</template>

<style scoped lang="scss">
.project-usage-view {
  display: flex;
  flex: 1;
  gap: 16px;
  min-height: 0;
  flex-direction: column;
}

.project-usage-view__explorer {
  flex: 1;
  min-height: 0;

  :deep(.ds-split-view) {
    height: 100%;
  }
}

.project-usage-view__detail {
  display: flex;
  gap: 16px;
  height: 100%;
  min-height: 0;
  flex-direction: column;

  > :deep(.ds-panel) {
    flex: 1;
    min-height: 0;
  }
}

.project-usage-view__charts {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 16px;
}

@media (max-width: 1400px) {
  .project-usage-view__charts {
    grid-template-columns: 1fr;
  }
}
</style>

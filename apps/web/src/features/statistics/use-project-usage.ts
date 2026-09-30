import { computed, onMounted, reactive, ref, watch } from 'vue';
import type {
  DailyUsagePoint,
  PaginatedResult,
  ProjectUsageStats,
  SessionSummary,
} from '@ai-manage/shared';
import { api } from '../../api';
import { refreshRevision, selectedTool } from '../../state/app-state';
import { runWithApiFeedback } from '../../shared/composables/use-api-feedback';
import { buildTrendOption, buildToolCallOption } from './usage-chart-options';

/** 会话明细单页加载数量，与历史会话页保持一致的「大页 + 前端展示」策略。 */
const SESSION_PAGE_SIZE = 1000;

/**
 * 项目作用域的用量统计数据：项目用量列表、选中项目的趋势 / 工具调用分布与会话明细。
 * 跟随左侧工具选择与索引刷新自动重载。
 */
export function useProjectUsage() {
  const projects = ref<ProjectUsageStats[]>([]);
  const daily = ref<DailyUsagePoint[]>([]);
  const sessions = reactive<PaginatedResult<SessionSummary>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: SESSION_PAGE_SIZE,
  });
  const selectedProjectPath = ref('');
  const trendDays = ref<number>(30);
  const loadingProjects = ref(false);
  const loadingSessions = ref(false);

  const selectedProject = computed(() =>
    projects.value.find(project => project.projectPath === selectedProjectPath.value),
  );

  /** 选中项目的按日 Token 堆叠面积图配置（未选择项目时为空数据）。 */
  const trendOption = computed(() => buildTrendOption(daily.value, selectedTool.value));

  /** 选中项目的工具调用分布环形图配置。 */
  const toolCallOption = computed(() =>
    buildToolCallOption(selectedProject.value?.toolCallBreakdown ?? {}),
  );

  /** Loads per-project usage stats and drops a stale selection. */
  async function loadProjects() {
    const projectResult = await api.statsProjects(selectedTool.value);
    projects.value = projectResult;
    if (!projectResult.some(project => project.projectPath === selectedProjectPath.value)) {
      selectedProjectPath.value = '';
    }
  }

  /** Loads the daily trend of the selected project (empty when none selected). */
  async function loadDaily() {
    if (!selectedProjectPath.value) {
      daily.value = [];
      return;
    }
    daily.value = await api.statsDaily({
      tool: selectedTool.value,
      projectPath: selectedProjectPath.value,
      days: trendDays.value,
    });
  }

  /** Loads the selected project's sessions (same endpoint as 历史会话). */
  async function loadSessions() {
    if (!selectedProjectPath.value) {
      Object.assign(sessions, { items: [], total: 0, page: 1, pageSize: SESSION_PAGE_SIZE });
      return;
    }
    loadingSessions.value = true;
    try {
      const result = await api.sessions({
        tool: selectedTool.value,
        projectPath: selectedProjectPath.value,
        page: 1,
        pageSize: SESSION_PAGE_SIZE,
      });
      Object.assign(sessions, result);
    } finally {
      loadingSessions.value = false;
    }
  }

  /** Reloads everything for the current tool. */
  async function reloadAll() {
    loadingProjects.value = true;
    try {
      await runWithApiFeedback(loadProjects);
    } finally {
      loadingProjects.value = false;
    }
    await Promise.all([runWithApiFeedback(loadDaily), runWithApiFeedback(loadSessions)]);
  }

  /** Selects (or deselects) a project and refreshes the scoped charts and table. */
  async function selectProject(projectPath: string) {
    selectedProjectPath.value = selectedProjectPath.value === projectPath ? '' : projectPath;
    Object.assign(sessions, { items: [], total: 0, page: 1, pageSize: SESSION_PAGE_SIZE });
    await Promise.all([runWithApiFeedback(loadDaily), runWithApiFeedback(loadSessions)]);
  }

  watch([selectedTool, refreshRevision], reloadAll);
  watch(trendDays, () => runWithApiFeedback(loadDaily));
  onMounted(reloadAll);

  return {
    projects,
    sessions,
    selectedProjectPath,
    selectedProject,
    trendDays,
    loadingSessions,
    trendOption,
    toolCallOption,
    selectProject,
  };
}

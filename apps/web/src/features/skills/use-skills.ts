import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { SkillDetail, SkillSource, SkillSummary } from '@ai-manage/shared';
import { api } from '../../api';
import { selectedTool } from '../../state/app-state';

const skillInputStyle = { minHeight: '100%', height: '100%' };
type SkillScopeFilter = 'all' | 'system' | 'project';

export interface SkillProjectGroup {
  key: string;
  projectName: string;
  projectPath: string;
  skills: SkillSummary[];
}

const skillScopeOptions: Array<{ label: string; value: SkillScopeFilter }> = [
  { label: '全部', value: 'all' },
  { label: '系统', value: 'system' },
  { label: '项目', value: 'project' },
];

/**
 * Owns skill list loading, scope filtering, and detail editing state.
 */
export function useSkills() {
  const skills = ref<SkillSummary[]>([]);
  const selectedSkill = ref<SkillDetail>();
  const draftRaw = ref('');
  const skillScopeFilter = ref<SkillScopeFilter>('all');
  const loadingList = ref(false);
  const loadingDetail = ref(false);
  const saving = ref(false);

  const isDirty = computed(() => !!selectedSkill.value && draftRaw.value !== selectedSkill.value.raw);

  /** Skills visible under the current system/project filter. */
  const filteredSkills = computed(() => {
    if (skillScopeFilter.value === 'all') return skills.value;
    return skills.value.filter(skill => skill.scope === skillScopeFilter.value);
  });
  const projectSkillGroups = computed<SkillProjectGroup[]>(() => {
    const groups = new Map<string, SkillProjectGroup>();
    for (const skill of skills.value) {
      if (skill.scope !== 'project') continue;
      const key = skill.projectPath || skill.projectName || 'unknown-project';
      const group = groups.get(key) || {
        key,
        projectName: skill.projectName || skill.projectPath || '未识别项目',
        projectPath: skill.projectPath || '',
        skills: [],
      };
      group.skills.push(skill);
      groups.set(key, group);
    }
    return [...groups.values()];
  });

  async function loadSkills() {
    loadingList.value = true;
    try {
      skills.value = await api.skills(selectedTool.value);
      if (selectedSkill.value && !skills.value.some(skill => skill.id === selectedSkill.value?.id)) {
        selectedSkill.value = undefined;
        draftRaw.value = '';
      }
      if (!selectedSkill.value && skills.value.length) await selectSkill(skills.value[0].id);
    } finally {
      loadingList.value = false;
    }
  }

  async function selectSkill(id: string) {
    loadingDetail.value = true;
    try {
      applyDetail(await api.skill(id));
    } finally {
      loadingDetail.value = false;
    }
  }

  async function reloadSelected() {
    if (!selectedSkill.value) return;
    await selectSkill(selectedSkill.value.id);
  }

  function applyDetail(detail: SkillDetail) {
    selectedSkill.value = detail;
    draftRaw.value = detail.raw;
    skills.value = skills.value.map(skill => skill.id === detail.id ? detail : skill);
  }

  function resetDraft() {
    if (!selectedSkill.value) return;
    draftRaw.value = selectedSkill.value.raw;
  }

  async function saveSkill() {
    if (!selectedSkill.value) return;
    saving.value = true;
    try {
      const response = await api.saveSkill(selectedSkill.value.id, {
        expectedHash: selectedSkill.value.hash,
        raw: draftRaw.value,
      });
      applyDetail(response.detail);
      ElMessage.success(`已保存，备份：${response.backupPath}`);
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    } finally {
      saving.value = false;
    }
  }

  function sourceLabel(source: SkillSource) {
    return source === 'codex' ? 'Codex' : 'Claude';
  }

  function skillScopeLabel(skill: SkillSummary) {
    return skill.system ? '系统' : '项目';
  }

  function formatSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  watch(selectedTool, loadSkills, { immediate: true });

  return {
    skills,
    filteredSkills,
    projectSkillGroups,
    selectedSkill,
    draftRaw,
    skillScopeFilter,
    skillScopeOptions,
    loadingList,
    loadingDetail,
    saving,
    skillInputStyle,
    isDirty,
    loadSkills,
    selectSkill,
    reloadSelected,
    resetDraft,
    saveSkill,
    sourceLabel,
    skillScopeLabel,
    formatSize,
  };
}

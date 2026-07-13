import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { SkillDetail, SkillSource, SkillSummary } from '@ai-manage/shared';
import { api } from '../../api';
import { selectedTool } from '../../state/app-state';

const skillInputStyle = { minHeight: '100%', height: '100%' };
type SkillScopeFilter = 'all' | 'system' | 'project' | 'local';

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
  { label: '本地', value: 'local' },
];

/**
 * Owns skill list loading, scope filtering, and detail editing state.
 */
export function useSkills() {
  const skills = ref<SkillSummary[]>([]);
  const localSkills = ref<SkillSummary[]>([]);
  const selectedSkill = ref<SkillDetail>();
  const draftRaw = ref('');
  const skillScopeFilter = ref<SkillScopeFilter>('all');
  const loadingList = ref(false);
  const loadingDetail = ref(false);
  const saving = ref(false);
  const favoriteUpdatingSkillIds = ref<ReadonlySet<string>>(new Set());

  const isDirty = computed(() => !!selectedSkill.value && draftRaw.value !== selectedSkill.value.raw);

  /** Skills visible under the current source-scope or local filter. */
  const filteredSkills = computed(() => {
    if (skillScopeFilter.value === 'local') return localSkills.value;
    if (skillScopeFilter.value === 'all') return skills.value;
    return skills.value.filter(skill => skill.scope === skillScopeFilter.value);
  });
  const totalSkillCount = computed(() => (
    skillScopeFilter.value === 'local' ? localSkills.value.length : skills.value.length
  ));
  const favoriteOriginIds = computed(() => new Set(
    localSkills.value
      .map(skill => skill.originSkillId)
      .filter((id): id is string => Boolean(id)),
  ));
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
      const [toolSkills, favoriteSkills] = await Promise.all([
        api.skills(selectedTool.value),
        api.localSkills(),
      ]);
      skills.value = toolSkills;
      localSkills.value = favoriteSkills;
      const allSkills = [...skills.value, ...localSkills.value];
      if (selectedSkill.value && !allSkills.some(skill => skill.id === selectedSkill.value?.id)) {
        selectedSkill.value = undefined;
        draftRaw.value = '';
      }
      if (!selectedSkill.value && allSkills.length) await selectSkill(allSkills[0].id);
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
    if (detail.scope === 'local') {
      localSkills.value = localSkills.value.map(skill => skill.id === detail.id ? detail : skill);
    } else {
      skills.value = skills.value.map(skill => skill.id === detail.id ? detail : skill);
    }
  }

  /** Adds or removes one skill from the local favorites directory. */
  async function toggleFavoriteSkill(skillId: string) {
    if (favoriteUpdatingSkillIds.value.has(skillId)) return;
    favoriteUpdatingSkillIds.value = new Set([
      ...favoriteUpdatingSkillIds.value,
      skillId,
    ]);
    try {
      if (favoriteOriginIds.value.has(skillId)) {
        const response = await api.unfavoriteSkill(skillId);
        localSkills.value = localSkills.value.filter(
          skill => skill.originSkillId !== response.originSkillId,
        );
        if (
          selectedSkill.value?.scope === 'local'
          && selectedSkill.value.originSkillId === response.originSkillId
        ) {
          selectedSkill.value = undefined;
          draftRaw.value = '';
        }
        ElMessage.success('已取消收藏');
        return 'unfavorited' as const;
      }

      const response = await api.favoriteSkill(skillId);
      localSkills.value = [
        ...localSkills.value.filter(skill => skill.originSkillId !== response.skill.originSkillId),
        response.skill,
      ].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      ElMessage.success(`已收藏到本地：${response.localPath}`);
      return 'favorited' as const;
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    } finally {
      const nextIds = new Set(favoriteUpdatingSkillIds.value);
      nextIds.delete(skillId);
      favoriteUpdatingSkillIds.value = nextIds;
    }
  }

  function isSkillFavorited(skillId: string) {
    return favoriteOriginIds.value.has(skillId);
  }

  function isSkillFavoriteUpdating(skillId: string) {
    return favoriteUpdatingSkillIds.value.has(skillId);
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

  function skillSourceLabel(skill: SkillSummary) {
    return skill.scope === 'local' ? '本地收藏' : sourceLabel(skill.source);
  }

  function skillScopeLabel(skill: SkillSummary) {
    if (skill.scope === 'local') return '本地';
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
    localSkills,
    filteredSkills,
    totalSkillCount,
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
    toggleFavoriteSkill,
    isSkillFavorited,
    isSkillFavoriteUpdating,
    skillSourceLabel,
    skillScopeLabel,
    formatSize,
  };
}

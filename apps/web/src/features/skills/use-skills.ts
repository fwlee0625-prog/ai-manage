import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { SkillDetail, SkillSource, SkillSummary } from '@ai-manage/shared';
import { api } from '../../api';

const skillInputStyle = { minHeight: '100%', height: '100%' };

export function useSkills() {
  const skills = ref<SkillSummary[]>([]);
  const selectedSkill = ref<SkillDetail>();
  const draftRaw = ref('');
  const loadingList = ref(false);
  const loadingDetail = ref(false);
  const saving = ref(false);

  const isDirty = computed(() => !!selectedSkill.value && draftRaw.value !== selectedSkill.value.raw);

  async function loadSkills() {
    loadingList.value = true;
    try {
      skills.value = await api.skills();
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
    return source === 'codex' ? 'Codex' : 'Agents';
  }

  function formatSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  onMounted(loadSkills);

  return {
    skills,
    selectedSkill,
    draftRaw,
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
    formatSize,
  };
}

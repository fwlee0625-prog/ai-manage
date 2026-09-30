<script setup lang="ts">
import { shallowRef } from 'vue';
import { DsPageHeader } from '../../components/design-system';
import GlobalUsageView from './components/GlobalUsageView.vue';
import ProjectUsageView from './components/ProjectUsageView.vue';

/** 用量统计的作用域：全局聚合，或按项目查看。 */
type UsageScope = 'global' | 'project';

/**
 * 用量统计页父组件：仅负责全局 / 项目作用域切换，
 * 两个作用域的页面内容分别由 GlobalUsageView / ProjectUsageView 自治渲染。
 * 索引刷新走顶栏的全局「刷新索引」按钮。
 */
const scope = shallowRef<UsageScope>('global');
</script>

<template>
  <section class="statistics-page">
    <DsPageHeader
      title="用量统计"
      description="按会话索引聚合的 Token 用量与工具调用统计（跟随左侧工具选择）"
    >
      <template #actions>
        <el-radio-group v-model="scope" size="small">
          <el-radio-button value="global">全局</el-radio-button>
          <el-radio-button value="project">项目</el-radio-button>
        </el-radio-group>
      </template>
    </DsPageHeader>

    <GlobalUsageView v-if="scope === 'global'" />
    <ProjectUsageView v-else />
  </section>
</template>

<style scoped lang="scss">
.statistics-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: auto;
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { EChartsType } from 'echarts/core';
import { echarts, type EchartsOption } from '../echarts-setup';

/**
 * Generic ECharts container: renders the given option and keeps the canvas
 * resized to its wrapper via ResizeObserver, disposing on unmount.
 */
const props = defineProps<{
  /** ECharts option, rebuilt by the parent whenever the underlying data changes. */
  option: EchartsOption;
  /** CSS height of the chart area. */
  height?: string;
}>();

const container = ref<HTMLDivElement>();
let chart: EChartsType | undefined;
let observer: ResizeObserver | undefined;

onMounted(() => {
  if (!container.value) return;
  chart = echarts.init(container.value);
  chart.setOption(props.option);
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(container.value);
});

watch(() => props.option, option => chart?.setOption(option, true));

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = undefined;
  chart?.dispose();
  chart = undefined;
});
</script>

<template>
  <div ref="container" class="stat-chart" :style="{ height: height || '260px' }"></div>
</template>

<style scoped lang="scss">
.stat-chart {
  min-width: 0;
  width: 100%;
}
</style>

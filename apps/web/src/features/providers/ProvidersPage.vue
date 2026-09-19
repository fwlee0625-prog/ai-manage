<script setup lang="ts">
import CurrentRuntimeCard from './components/CurrentRuntimeCard.vue';
import ProviderDrawer from './components/ProviderDrawer.vue';
import ProviderGrid from './components/ProviderGrid.vue';
import ProviderTestResult from './components/ProviderTestResult.vue';
import { useProviders } from './use-providers';

const vm = useProviders();
</script>
<template>
  <section class="providers-page">
    <CurrentRuntimeCard :runtime="vm.runtime.value" :loading="vm.loading.value" @refresh="vm.load" />
    <section class="toolbar"><div><h2>供应商</h2><p>Provider 与凭据由 AI Manage 独立托管，live 配置只作为运行投影。</p></div><div><el-button @click="vm.importLive">导入当前配置</el-button><el-button type="primary" @click="vm.openCreate">添加供应商</el-button></div></section>
    <ProviderTestResult :result="vm.testResult.value" />
    <ProviderGrid :providers="vm.providers.value" :active-id="vm.runtime.value?.managedProviderId" :switching-id="vm.switchingId.value"
      @switch="vm.switchProvider" @edit="vm.openEdit" @duplicate="vm.duplicate" @test="vm.test" @remove="vm.remove" />
    <ProviderDrawer v-model:visible="vm.drawerVisible.value" v-model:draft="vm.draft.value" :presets="vm.presets.value" :editing="vm.editing.value" :saving="vm.saving.value" :models="vm.models.value" :model-loading="vm.modelLoading.value"
      @select-preset="vm.applyPreset" @save="vm.save" @fetch-models="vm.fetchModels" />
  </section>
</template>
<style scoped lang="scss">
.providers-page{display:flex;min-height:0;flex-direction:column;gap:16px;overflow:auto}.toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}.toolbar h2{margin:0}.toolbar p{margin:6px 0 0;color:var(--ds-color-text-muted);font-size:13px}
</style>

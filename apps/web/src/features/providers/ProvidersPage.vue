<script setup lang="ts">
import { selectedTool } from '../../state/app-state';
import AccountCenterDrawer from '../accounts/components/AccountCenterDrawer.vue';
import DeviceLoginDialog from '../accounts/components/DeviceLoginDialog.vue';
import { useAccounts } from '../accounts/use-accounts';
import CurrentRuntimeCard from './components/CurrentRuntimeCard.vue';
import ProviderDrawer from './components/ProviderDrawer.vue';
import ProviderGrid from './components/ProviderGrid.vue';
import ProviderTestResult from './components/ProviderTestResult.vue';
import { useProviders } from './use-providers';

const {
  accounts, centerVisible, deviceVisible, deviceLogin, polling,
  openCenter, addAccount, reauth, setDefault, remove: removeAccount,
  pollDeviceLogin, closeDeviceLogin,
} = useAccounts();
const {
  providers, presets, runtime, loading, saving, switchingId, drawerVisible, draft, editing,
  testResult, models, modelLoading, load, openCreate, openEdit, applyPreset, save,
  switchProvider, duplicate, remove, test, fetchModels, importLive,
} = useProviders();
</script>

<template>
  <section class="providers-page">
    <CurrentRuntimeCard :runtime="runtime" :loading="loading" @refresh="load" />
    <section class="toolbar">
      <div>
        <h2>供应商</h2>
        <p>Provider 与账号身份独立管理，切换时由 Runtime Engine 投影到 live 配置。</p>
      </div>
      <div>
        <el-button v-if="selectedTool === 'codex'" @click="openCenter">账号中心</el-button>
        <el-button @click="importLive">导入当前配置</el-button>
        <el-button type="primary" @click="openCreate">添加供应商</el-button>
      </div>
    </section>

    <ProviderTestResult :result="testResult" />
    <ProviderGrid
      :providers="providers"
      :active-id="runtime?.managedProviderId"
      :switching-id="switchingId"
      @switch="switchProvider"
      @edit="openEdit"
      @duplicate="duplicate"
      @test="test"
      @remove="remove"
    />

    <ProviderDrawer
      v-model:visible="drawerVisible"
      v-model:draft="draft"
      :presets="presets"
      :accounts="accounts"
      :editing="editing"
      :saving="saving"
      :models="models"
      :model-loading="modelLoading"
      @select-preset="applyPreset"
      @save="save"
      @fetch-models="fetchModels"
      @open-accounts="openCenter"
    />

    <AccountCenterDrawer
      v-model:visible="centerVisible"
      :accounts="accounts"
      @add="addAccount"
      @reauth="reauth"
      @set-default="setDefault"
      @remove="removeAccount"
    />
    <DeviceLoginDialog
      :visible="deviceVisible"
      :login="deviceLogin"
      :polling="polling"
      @close="closeDeviceLogin"
      @poll="pollDeviceLogin"
    />
  </section>
</template>

<style scoped lang="scss">
.providers-page { display: flex; min-height: 0; flex-direction: column; gap: 16px; overflow: auto; }
.toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.toolbar h2 { margin: 0; }
.toolbar p { margin: 6px 0 0; color: var(--ds-color-text-muted); font-size: 13px; }
</style>

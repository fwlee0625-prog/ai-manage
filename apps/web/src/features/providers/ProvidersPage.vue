<script setup lang="ts">
import { watch } from 'vue';
import { selectedTool } from '../../state/app-state';
import AccountCenterDrawer from '../accounts/components/AccountCenterDrawer.vue';
import DeviceLoginDialog from '../accounts/components/DeviceLoginDialog.vue';
import { useAccounts } from '../accounts/use-accounts';
import ProviderDrawer from './components/ProviderDrawer.vue';
import ProviderGrid from './components/ProviderGrid.vue';
import { useProviders } from './use-providers';

const {
  accounts, centerVisible, deviceVisible, deviceLogin, polling, deviceStatus, lastAddedAccountId,
  openCenter, addAccount, reauth, setDefault, remove: removeAccount,
  pollDeviceLogin, closeDeviceLogin,
} = useAccounts();
const {
  providers, presets, runtime, saving, switchingId, testingId, drawerVisible, draft, editing,
  models, modelLoading, healthById, openCreate, openEdit, applyPreset, save,
  switchProvider, duplicate, remove, test, fetchModels, adoptLive, restoreManaged, importLive,
} = useProviders();

watch(lastAddedAccountId, (accountId) => {
  if (!accountId || !drawerVisible.value || draft.value.authMode !== 'managed_account') return;
  draft.value.accountId = accountId;
});
</script>

<template>
  <section class="providers-page">
    <section class="toolbar">
      <div>
        <h2>供应商</h2>
        <p>供应商与账号身份独立管理，切换时由 Runtime Engine 投影到 live 配置。</p>
      </div>
      <div class="toolbar__actions">
        <el-button
          v-if="runtime?.syncStatus === 'externally_modified' || runtime?.syncStatus === 'unmanaged'"
          @click="adoptLive"
        >
          采用当前状态
        </el-button>
        <el-button
          v-if="runtime?.managedProviderId && runtime?.syncStatus !== 'synced'"
          type="primary"
          plain
          @click="restoreManaged"
        >
          恢复 AI Manage 配置
        </el-button>
        <el-button v-if="selectedTool === 'codex'" @click="openCenter">账号中心</el-button>
        <el-button @click="importLive">导入当前配置</el-button>
        <el-button type="primary" @click="openCreate">添加供应商</el-button>
      </div>
    </section>

    <el-alert
      v-if="!providers.length && runtime?.model"
      title="发现现有配置"
      :description="`检测到当前 live 模型 ${runtime.model}，可以先导入为托管供应商，不会修改 live 文件。`"
      type="info"
      show-icon
      :closable="false"
    >
      <template #default>
        <el-button size="small" type="primary" plain @click="importLive">导入现有配置</el-button>
      </template>
    </el-alert>
    <ProviderGrid
      :providers="providers"
      :active-id="runtime?.managedProviderId"
      :switching-id="switchingId"
      :testing-id="testingId"
      :health-by-id="healthById"
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
      @add-account="addAccount"
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
      :status="deviceStatus"
      @close="closeDeviceLogin"
      @poll="pollDeviceLogin"
    />
  </section>
</template>

<style scoped lang="scss">
.providers-page { display: flex; min-height: 0; flex-direction: column; gap: 16px; height: 100%; overflow: auto; }
.toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.toolbar__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.toolbar__actions :deep(.el-button + .el-button) { margin-left: 0; }
.toolbar h2 { margin: 0; }
.toolbar p { margin: 6px 0 0; color: var(--ds-color-text-muted); font-size: 13px; }
</style>

import { onUnmounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { ManagedAccount, StartDeviceLoginResponse } from '@ai-manage/shared';
import { api } from '../../api';
import { selectedTool } from '../../state/app-state';

export function useAccounts() {
  const accounts = ref<ManagedAccount[]>([]);
  const centerVisible = ref(false);
  const deviceVisible = ref(false);
  const deviceLogin = ref<StartDeviceLoginResponse>();
  const polling = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** Loads managed Codex accounts while keeping Claude account UI empty. */
  async function loadAccounts() {
    if (selectedTool.value !== 'codex') {
      accounts.value = [];
      return;
    }
    accounts.value = await api.accounts();
  }

  /** Opens the account center and refreshes account metadata. */
  async function openCenter() {
    centerVisible.value = true;
    await loadAccounts();
  }

  /** Starts a new ChatGPT device-code login. */
  async function addAccount() {
    try {
      beginDeviceLogin(await api.startCodexDeviceLogin());
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    }
  }

  /** Starts reauthentication while preserving the stable local account id. */
  async function reauth(account: ManagedAccount) {
    try {
      beginDeviceLogin(await api.reauthAccount(account.id));
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error));
    }
  }

  /** Marks one account as the default managed Codex account. */
  async function setDefault(account: ManagedAccount) {
    await api.setDefaultAccount(account.id);
    ElMessage.success('默认账号已更新');
    await loadAccounts();
  }

  /** Deletes one unbound account after explicit confirmation. */
  async function remove(account: ManagedAccount) {
    try {
      await ElMessageBox.confirm(`确定删除“${account.displayName || account.email || 'ChatGPT Account'}”吗？`, '删除账号', { type: 'warning' });
      await api.deleteAccount(account.id);
      ElMessage.success('账号已删除');
      await loadAccounts();
    } catch (error) {
      if (error === 'cancel' || error === 'close') return;
      ElMessage.error(error instanceof Error ? error.message : String(error));
    }
  }

  /** Polls one device login once and schedules the next poll only while pending. */
  async function pollDeviceLogin() {
    const login = deviceLogin.value;
    if (!login || polling.value) return;
    polling.value = true;
    try {
      const result = await api.pollCodexDeviceLogin(login.loginId);
      if (result.status === 'complete') {
        clearPollTimer();
        deviceVisible.value = false;
        deviceLogin.value = undefined;
        ElMessage.success('ChatGPT 账号已添加');
        await loadAccounts();
        return;
      }
      if (result.status === 'expired') {
        clearPollTimer();
        ElMessage.warning('设备登录已过期，请重新开始');
        return;
      }
      schedulePoll(login.intervalSeconds);
    } catch (error) {
      clearPollTimer();
      ElMessage.error(error instanceof Error ? error.message : String(error));
    } finally {
      polling.value = false;
    }
  }

  /** Closes the device dialog and stops client-side polling. */
  function closeDeviceLogin() {
    clearPollTimer();
    deviceVisible.value = false;
    deviceLogin.value = undefined;
  }

  function beginDeviceLogin(login: StartDeviceLoginResponse) {
    clearPollTimer();
    deviceLogin.value = login;
    deviceVisible.value = true;
    schedulePoll(login.intervalSeconds);
  }

  function schedulePoll(seconds: number) {
    clearPollTimer();
    timer = setTimeout(() => void pollDeviceLogin(), Math.max(1, seconds) * 1000);
  }

  function clearPollTimer() {
    if (timer) clearTimeout(timer);
    timer = undefined;
  }

  watch(selectedTool, () => {
    centerVisible.value = false;
    closeDeviceLogin();
    void loadAccounts();
  }, { immediate: true });
  onUnmounted(clearPollTimer);

  return {
    accounts,
    centerVisible,
    deviceVisible,
    deviceLogin,
    polling,
    loadAccounts,
    openCenter,
    addAccount,
    reauth,
    setDefault,
    remove,
    pollDeviceLogin,
    closeDeviceLogin,
  };
}

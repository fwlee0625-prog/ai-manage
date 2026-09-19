<script setup lang="ts">
import type { StartDeviceLoginResponse } from '@ai-manage/shared';

defineProps<{ visible: boolean; login?: StartDeviceLoginResponse; polling?: boolean }>();
defineEmits<{ close: []; poll: [] }>();

/** Copies the one-time code using the browser clipboard when available. */
async function copyCode(code?: string) {
  if (code && navigator.clipboard) await navigator.clipboard.writeText(code);
}
</script>

<template>
  <el-dialog :model-value="visible" title="连接 ChatGPT 账号" width="520px" :close-on-click-modal="false" @close="$emit('close')">
    <template v-if="login">
      <el-steps direction="vertical" :active="1">
        <el-step title="打开验证页面">
          <template #description>
            <a :href="login.verificationUrl" target="_blank" rel="noreferrer">{{ login.verificationUrl }}</a>
          </template>
        </el-step>
        <el-step title="输入一次性代码">
          <template #description>
            <div class="code-row">
              <strong>{{ login.userCode }}</strong>
              <el-button size="small" @click="copyCode(login.userCode)">复制</el-button>
            </div>
          </template>
        </el-step>
        <el-step title="等待授权完成" description="完成浏览器授权后，本页会自动检测登录结果。" />
      </el-steps>
      <el-alert title="仅在你刚刚从 AI Manage 发起登录时输入此代码。" type="warning" :closable="false" show-icon />
    </template>
    <template #footer>
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" :loading="polling" @click="$emit('poll')">我已完成授权</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.code-row { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.code-row strong { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 20px; letter-spacing: 2px; }
</style>

<script setup lang="ts">
import { DsPanel } from '../../../components/design-system';
import type { ConfigMenuItem } from '../use-configs';

defineProps<{
  selectedMenuId: string;
  menuItems: ConfigMenuItem[];
}>();

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<template>
  <DsPanel fill class="config-list" title="配置菜单" description="选择要编辑的配置分组或文件">
    <el-menu
      :default-active="selectedMenuId"
      class="config-menu"
      @select="emit('select', $event)"
    >
      <el-menu-item v-for="item in menuItems" :key="item.id" :index="item.id">
        <div class="menu-item-content">
          <span>{{ item.label }}</span>
          <small>{{ item.description }}</small>
        </div>
      </el-menu-item>
    </el-menu>
    <el-empty v-if="!menuItems.length" description="暂无可编辑配置" />
  </DsPanel>
</template>

<style scoped lang="scss">
.config-menu {
  height: 100%;
  overflow: auto;
  border-right: 0;
}

.config-menu :deep(.el-menu-item) {
  height: auto;
  align-items: flex-start;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: var(--ds-radius-control);
  background: transparent;
  color: var(--ds-color-text);
  padding: 10px 12px;
  line-height: 1.35;
}

.config-menu :deep(.el-menu-item:hover),
.config-menu :deep(.el-menu-item.is-active) {
  border-color: var(--ds-state-active-border);
  background: var(--ds-state-active-bg);
  color: var(--ds-state-active-color);
}

.menu-item-content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.menu-item-content span,
.menu-item-content small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-item-content small {
  color: var(--ds-color-text-muted);
  font-size: 12px;
}
</style>

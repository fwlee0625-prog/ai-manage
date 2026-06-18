import type { App, Component } from 'vue';
import {
  ElAlert,
  ElAside,
  ElButton,
  ElCard,
  ElCheckboxButton,
  ElCheckboxGroup,
  ElContainer,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElHeader,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElScrollbar,
  ElSkeleton,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTooltip,
  ElLoading,
} from 'element-plus';

const components: Component[] = [
  ElAlert,
  ElAside,
  ElButton,
  ElCard,
  ElCheckboxButton,
  ElCheckboxGroup,
  ElContainer,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElHeader,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElScrollbar,
  ElSkeleton,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTooltip,
];

/**
 * Registers only the Element Plus pieces used by the PC application shell and feature pages.
 */
export function registerElementPlus(app: App) {
  for (const component of components) {
    app.component(component.name as string, component);
  }
  app.directive('loading', ElLoading.directive);
}

import { createApp } from 'vue';
import 'element-plus/dist/index.css';
import './styles/tokens.scss';
import './styles/base.scss';
import './styles/element-plus.scss';
import './styles/utilities.scss';
import App from './App.vue';
import { router } from './router';
import { registerElementPlus } from './plugins/element-plus';

/**
 * Disables the browser default context menu across the PC management app.
 */
function disableDefaultContextMenu() {
  window.addEventListener('contextmenu', event => {
    event.preventDefault();
  });
}

const app = createApp(App);
disableDefaultContextMenu();
app.use(router);
registerElementPlus(app);
app.mount('#app');

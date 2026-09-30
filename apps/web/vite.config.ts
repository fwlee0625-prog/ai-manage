import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        /**
         * Keeps route chunks small while grouping desktop UI dependencies into a cacheable vendor bundle.
         * echarts 体积较大且只有「用量统计」页使用，单独拆分让它跟随路由懒加载，不进首屏 vendor。
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("echarts") || id.includes("zrender")) return "echarts";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5177,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        ws: true,
      },
    },
  },
});

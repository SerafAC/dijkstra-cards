import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import wails from "@wailsio/runtime/plugins/vite";
import Components from "unplugin-vue-components/vite";
import { PrimeVueResolver } from "@primevue/auto-import-resolver";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    wails("./bindings"),
    Components({
      resolvers: [PrimeVueResolver()],
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @import "./src/styles/main.scss";
        `
      }
    }
  }
});

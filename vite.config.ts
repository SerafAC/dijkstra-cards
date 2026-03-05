import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import webExtension from 'vite-plugin-web-extension'
import { readFileSync } from 'fs'

type Browser = 'chrome' | 'firefox'

const isDevPage = process.env.DEV_PAGE === '1'
const browser = (process.env.TARGET_BROWSER as Browser) || 'chrome'

function generateManifest() {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf-8'))

  // Remove Firefox-specific fields for Chrome to avoid manifest warnings
  if (browser === 'chrome') {
    delete manifest.browser_specific_settings
  }

  return manifest
}

const plugins: PluginOption[] = [vue()]

if (!isDevPage) {
  plugins.push(
    webExtension({
      manifest: generateManifest,
      browser,
      additionalInputs: ['src/popup/index.html'],
    }),
  )
}

export default defineConfig({
  root: isDevPage ? 'src/popup' : undefined,
  plugins,
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: isDevPage
          ? `
          @use "@/scss/variables.scss";
          @use "@/scss/mixins.scss";
        `
          : `
          @use "@/popup/scss/variables.scss";
          @use "@/popup/scss/mixins.scss";
        `
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL(isDevPage ? '.' : 'src', import.meta.url))
    }
  },
  build: {
    outDir: `dist/${browser}`,
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
  },
})

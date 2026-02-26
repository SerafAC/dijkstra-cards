import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import webExtension from 'vite-plugin-web-extension'
import { readFileSync } from 'fs'

type Browser = 'chrome' | 'firefox'

const browser = (process.env.TARGET_BROWSER as Browser) || 'chrome'

function generateManifest() {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf-8'))

  // Remove Firefox-specific fields for Chrome to avoid manifest warnings
  if (browser === 'chrome') {
    delete manifest.browser_specific_settings
  }

  return manifest
}

export default defineConfig({
  plugins: [
    vue(),
    webExtension({
      manifest: generateManifest,
      browser,
      additionalInputs: ['src/popup/index.html'],
    }),
  ],
  build: {
    outDir: `dist/${browser}`,
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
  },
})

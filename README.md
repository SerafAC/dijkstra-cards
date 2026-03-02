# Dijkstra Cards

A carts shopping cart optimizer.

## Stack

| Tool | Purpose |
|---|---|
| [Vue 3](https://vuejs.org/) | UI framework with `<script setup>` + TypeScript |
| [PrimeVue 4](https://primevue.org/) | Component library (Aura theme) |
| [Vite 6](https://vitejs.dev/) | Fast bundler |
| [vite-plugin-web-extension](https://vite-plugin-web-extension.aklinker1.io/) | Multi-entry extension builder |

## Project Structure

```
dijkstra-cards/
├── public/
│   └── icons/               # Addon icons
├── src/
│   ├── assets/
│   │   └── logo.svg         # Extension logo used in the popup
│   ├── background/
│   │   └── index.ts         # MV3 service worker (background script)
│   └── popup/
│       ├── index.html       # Popup HTML entry point
│       ├── main.ts          # Vue app bootstrap + PrimeVue setup
│       └── App.vue          # "Hello World" popup component
├── manifest.json            # Extension manifest (MV3, cross-browser)
├── vite.config.ts           # Vite + web extension plugin config
└── tsconfig.json
```

## Getting Started

```bash
# Install dependencies (icons are auto-generated via postinstall)
pnpm install

# Development – Chrome (watch mode, outputs to dist/chrome/)
pnpm run dev

# Development – Firefox (watch mode, outputs to dist/firefox/)
pnpm run dev:firefox

# Production build – Chrome
pnpm run build

# Production build – Firefox
pnpm run build:firefox

# TypeScript type-check
pnpm run type-check
```

### Load the extension

**Chrome / Chromium**
1. `pnpm run build`
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select `dist/chrome/`

**Firefox**
1. `pnpm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on…** → select any file inside `dist/firefox/`

### Cross-browser API (`browser.*` vs `chrome.*`)
The background script uses `chrome.*` which works in all Chromium browsers.
For true cross-browser `browser.*` with Promises, install the polyfill:
```bash
pnpm install webextension-polyfill
```
Then in any script:
```ts
import browser from 'webextension-polyfill'
await browser.tabs.query({ active: true })
```

## License

GNU General Public License v3.0

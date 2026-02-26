# Dijkstra Cards

A **Vue 3** browser extension boilerplate with **PrimeVue** for a great look and
feel, targeting both **Chrome** (Manifest V3) and **Firefox** (MV3, 109+).

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
│   └── icons/               # Auto-generated placeholder icons (replace before publishing)
├── scripts/
│   └── generate-icons.mjs   # Generates solid-color PNG icons (no deps)
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
npm install

# Development – Chrome (watch mode, outputs to dist/chrome/)
npm run dev

# Development – Firefox (watch mode, outputs to dist/firefox/)
npm run dev:firefox

# Production build – Chrome
npm run build

# Production build – Firefox
npm run build:firefox

# TypeScript type-check
npm run type-check
```

### Load the extension

**Chrome / Chromium**
1. `npm run build`
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select `dist/chrome/`

**Firefox**
1. `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on…** → select any file inside `dist/firefox/`

## Customisation

### Icons
The `public/icons/` folder contains auto-generated placeholder icons. Replace
them with your own 16×16, 32×32, 48×48 and 128×128 PNG files before
publishing.

You can re-run the generator at any time:
```bash
npm run generate-icons
```

### Extension name & IDs
- Update `name`, `version`, and `description` in both `package.json` and
  `manifest.json`.
- Set the Firefox extension ID in `manifest.json` →
  `browser_specific_settings.gecko.id`.

### Adding content scripts
Add a content script entry to `manifest.json`:
```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["src/content-script/index.ts"]
  }
]
```
Then create `src/content-script/index.ts`.

### Cross-browser API (`browser.*` vs `chrome.*`)
The background script uses `chrome.*` which works in all Chromium browsers.
For true cross-browser `browser.*` with Promises, install the polyfill:
```bash
npm install webextension-polyfill
```
Then in any script:
```ts
import browser from 'webextension-polyfill'
await browser.tabs.query({ active: true })
```

## License

MIT

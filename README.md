# Dijkstra Cards

<img src="./public/baner.png"/>

A cards shopping cart optimizer.

## Installation

Download the latest release from the [Releases page](https://github.com/SerafAC/dijkstra-cards/releases).

### Chrome / Chromium

1. Download the `dijkstra-cards-chrome-vX.Y.Z.zip` asset and extract it to a folder.
2. Open `chrome://extensions/` in your browser.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the extracted folder.

### Firefox

1. Download the `dijkstra-cards-firefox-vX.Y.Z.xpi` asset.
2. Open `about:addons` in Firefox.
3. Click the gear icon ⚙ → **Install Add-on From File…**
4. Select the downloaded `.xpi` file and click **Add** when prompted.

> **Note:** If Firefox blocks the installation because the add-on is unsigned, you can load it temporarily via `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** and select the `.xpi` file. The add-on will be removed when Firefox restarts.

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

## Installation

Download the latest release from the [Releases page](https://github.com/SerafAC/dijkstra-cards/releases).

### Chrome / Chromium

1. Download the `dijkstra-cards-chrome-vX.Y.Z.zip` asset and extract it to a folder.
2. Open `chrome://extensions/` in your browser.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the extracted folder.

### Firefox

1. Download the `dijkstra-cards-firefox-vX.Y.Z.xpi` asset.
2. Open `about:addons` in Firefox.
3. Click the gear icon ⚙ → **Install Add-on From File…**
4. Select the downloaded `.xpi` file and click **Add** when prompted.

> **Note:** If Firefox blocks the installation because the add-on is unsigned, you can load it temporarily via `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** and select the `.xpi` file. The add-on will be removed when Firefox restarts.

## Usage

Dijkstra Cards finds the cheapest seller combination on [Cardmarket](https://www.cardmarket.com) for a list of Magic: The Gathering cards.

### 1. Import your deck

On [archidekt.com](https://archidekt.com), open your deck, click **⋮** → **Export** → **CSV** and save the file. Then click the extension icon, hit **Open Deck Export**, and select it. Recent decks are saved for quick re-access.

### 2. Select cards to optimize

In the **Deck** view, tick the cards you want to buy and click **Next**.

### 3. Configure filters (optional)

In the **Search** view, set your accepted **languages** and **minimum condition**, then click **Save filters** to persist them.

### 4. Assign sellers

Click **Assign sellers**. The extension fetches offers from Cardmarket for each card and finds the lowest-cost seller combination. A progress bar tracks the search. If a CAPTCHA appears, the tab will surface so you can solve it.

### 5. Review results

Results show the total cost and a per-card table of assigned sellers with links to Cardmarket. Cards that failed to fetch appear in a collapsible **Failed cards** section.

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

# Planned features

- [x] Search filters
- [x] Progress bar
- [x] Cards links
- [x] Dark/light mode
- [ ] Copy texts from table
- [ ] Archidekt export instructions
- [ ] Blacklisting sellers
- [ ] Card quantity
- [ ] CM login
- [ ] Cart adding
- [ ] Translations

## License

GNU General Public License v3.0

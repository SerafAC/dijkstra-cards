# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Dijkstra Cards** is a Chrome/Firefox browser extension (Manifest V3) that optimizes Magic: The Gathering card purchases on Cardmarket. It finds the cheapest seller combination for a wishlist using a greedy set-cover algorithm.

Stack: Vue 3 + TypeScript + Vite + PrimeVue 4 (Aura theme, red primary) + Sentry

## Commands

```bash
pnpm dev              # Chrome build in watch mode
pnpm dev:page         # Run popup as standalone page (DEV_PAGE=1)
pnpm dev:firefox      # Firefox build in watch mode
pnpm build            # Chrome production build → dist/chrome/
pnpm build:firefox    # Firefox production build → dist/firefox/
pnpm type-check       # TypeScript validation (vue-tsc --noEmit)
pnpm lint             # ESLint
pnpm lint:fix         # ESLint with auto-fix
pnpm format           # Prettier format src/
pnpm format:check     # Prettier check only
```

## Architecture

### Extension Structure

- **`src/background/index.ts`** — MV3 service worker. Opens popup in a window on action click, routes messages (currently only "ping").
- **`src/popup/`** — The entire popup app. Entry: `main.ts` (mounts Vue, sets up Sentry + PrimeVue).

### Routing (`src/popup/router.ts`)

Hash-based, 4 views:
| Route | View | Purpose |
|-------|------|---------|
| `/` | `StartView` | Import CSV deck, open recent decks/projects |
| `/deck` | `DeckView` | Select cards from the loaded deck |
| `/search` | `SearchCardsPage` | Run seller search, view assignments |
| `/settings` | `SettingsPage` | Filters (language, condition, country) |

### Services (`src/popup/services/`)

Services are stateless async modules except `CardService` which holds in-memory state.

- **`CardService`** — Loads and parses CSV decks. Holds the active deck in memory. Generates UUIDs per card and auto-builds Cardmarket URLs.
- **`CardmarketService`** — Orchestrates the scraping flow: opens a persistent tab, navigates to each card page, applies URL-based filters, parses the seller table from HTML. Respects a configurable rate-limit interval (default 5s).
- **`TabFetchService`** — Low-level Chrome tab automation using `chrome.scripting.executeScript`. Navigates tabs, types into search bars, clicks elements, polls for page readiness, and extracts HTML. Retries for up to 10 minutes; focuses the tab after 2nd retry to surface CAPTCHAs to the user.
- **`SellerAssignmentService`** — Greedy set-cover: repeatedly picks the seller covering the most unassigned cards (ties broken by lowest total price) until all cards are assigned.
- **`ProjectService`** — Saves/loads `.dcproject.json` files using the File System Access API (with a `<input type="file">` fallback). A project bundles the CSV, selected cards, filters, assignments, and errors.
- **`StorageService`** — Thin wrapper over `chrome.storage.local`. Stores recent decks, recent projects, filters, app settings, and cached search results keyed by deck filename.
- **`Browser`** — `OpenURL(url)` → `window.open(url, '_blank')`.

### State (`src/popup/stores/`)

Plain Vue `ref` composition stores — no Pinia.

- **`projectStore`** — Holds `FileSystemFileHandle` (or fallback filename) for auto-save.
- **`selectedCards`** — Holds the active `Card[]` and deck filename in memory.

Persistence is manual: services write to `chrome.storage.local` or project files.

### Data Flow

1. **Import CSV** (`StartView`) → `CardService.LoadCards()` → cards stored in `selectedCards` store + `StorageService` (recent decks)
2. **Select cards** (`DeckView`) → updates `selectedCards` store → navigate to `/search`
3. **Run search** (`SearchCardsPage`) → for each card: `CardmarketService.GetCardSellers()` → `TabFetchService` automation → collect `Seller[]` per card → `SellerAssignmentService.FindOptimalSellers()` → persist results to `StorageService`
4. **Save project** → `ProjectService.saveAs()` → `.dcproject.json` with full state
5. **Restore project** (`StartView`) → `ProjectService.open()` → rebuilds all state from file

### Key Types (`src/popup/types/models.ts`)

- `Card` — UUID, quantity, name, edition, Cardmarket link
- `Seller` — name, country (string + ID), condition, stock count, price
- `CardFilters` — language IDs, min condition, seller country IDs
- `ProjectFile` (version 1) — the `.dcproject.json` schema

## Code Conventions

- Single quotes, no semicolons, 2-space indent (enforced by Prettier + `.editorconfig`)
- Components use `<script setup lang="ts">`
- Path alias `@/` maps to `src/`
- SCSS variables/mixins from `src/popup/scss/` are auto-injected into every component

import type { AppSettings, CardFilters, PersistedSearchResults, RecentDeck, RecentProject } from '../types/models'

const RECENT_DECKS_KEY = 'recentDecks'
const RECENT_PROJECTS_KEY = 'recentProjects'
const CARD_FILTERS_KEY = 'cardFilters'
const APP_SETTINGS_KEY = 'appSettings'
const SEARCH_RESULTS_PREFIX = 'searchResults:'
const MAX_RECENT_DECKS = 10
const MAX_RECENT_PROJECTS = 10

export const DEFAULT_SETTINGS: AppSettings = {
  searchIntervalMs: 5_000,
}

// --- Chrome storage helpers ---

function storageGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key] as T | undefined))
  })
}

function storageSet(data: Record<string, unknown>): Promise<void> {
  const plain = JSON.parse(JSON.stringify(data))
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(plain, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(String(chrome.runtime.lastError)))
      } else {
        resolve()
      }
    })
  })
}

function storageRemove(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, resolve)
  })
}

// --- Public API ---

export const StorageService = {
  async getRecentDecks(): Promise<RecentDeck[]> {
    return (await storageGet<RecentDeck[]>(RECENT_DECKS_KEY)) ?? []
  },

  async addRecentDeck(fileName: string, csvContent: string, cardCount: number): Promise<void> {
    const decks = await this.getRecentDecks()
    const filtered = decks.filter((d) => d.fileName !== fileName)
    const entry: RecentDeck = { fileName, csvContent, cardCount, loadedAt: new Date().toISOString() }
    await storageSet({ [RECENT_DECKS_KEY]: [entry, ...filtered].slice(0, MAX_RECENT_DECKS) })
  },

  async removeRecentDeck(fileName: string): Promise<void> {
    const decks = await this.getRecentDecks()
    await storageSet({ [RECENT_DECKS_KEY]: decks.filter((d) => d.fileName !== fileName) })
  },

  async getRecentProjects(): Promise<RecentProject[]> {
    return (await storageGet<RecentProject[]>(RECENT_PROJECTS_KEY)) ?? []
  },

  async addRecentProject(fileName: string, projectContent: string, cardCount: number): Promise<void> {
    const projects = await this.getRecentProjects()
    const filtered = projects.filter((p) => p.fileName !== fileName)
    const entry: RecentProject = { fileName, projectContent, cardCount, loadedAt: new Date().toISOString() }
    await storageSet({ [RECENT_PROJECTS_KEY]: [entry, ...filtered].slice(0, MAX_RECENT_PROJECTS) })
  },

  async removeRecentProject(fileName: string): Promise<void> {
    const projects = await this.getRecentProjects()
    await storageSet({ [RECENT_PROJECTS_KEY]: projects.filter((p) => p.fileName !== fileName) })
  },

  async getCardFilters(): Promise<CardFilters | null> {
    return (await storageGet<CardFilters>(CARD_FILTERS_KEY)) ?? null
  },

  async saveCardFilters(filters: CardFilters): Promise<void> {
    await storageSet({ [CARD_FILTERS_KEY]: filters })
  },

  async getSettings(): Promise<AppSettings> {
    const stored = await storageGet<Partial<AppSettings>>(APP_SETTINGS_KEY)
    return { ...DEFAULT_SETTINGS, ...stored }
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    await storageSet({ [APP_SETTINGS_KEY]: settings })
  },

  async getSearchResults(deckFileName: string): Promise<PersistedSearchResults | null> {
    const key = SEARCH_RESULTS_PREFIX + deckFileName
    return (await storageGet<PersistedSearchResults>(key)) ?? null
  },

  async saveSearchResults(results: PersistedSearchResults): Promise<void> {
    const key = SEARCH_RESULTS_PREFIX + results.deckFileName
    await storageSet({ [key]: results })
  },

  async removeSearchResults(deckFileName: string): Promise<void> {
    await storageRemove(SEARCH_RESULTS_PREFIX + deckFileName)
  },
}

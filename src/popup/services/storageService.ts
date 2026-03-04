import type { CardFilters, PersistedSearchResults, RecentDeck } from '../types/models'

const RECENT_DECKS_KEY = 'recentDecks'
const CARD_FILTERS_KEY = 'cardFilters'
const SEARCH_RESULTS_PREFIX = 'searchResults:'
const MAX_RECENT_DECKS = 10

export const StorageService = {
  async getRecentDecks(): Promise<RecentDeck[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(RECENT_DECKS_KEY, (result) => {
        resolve((result[RECENT_DECKS_KEY] as RecentDeck[]) ?? [])
      })
    })
  },

  async addRecentDeck(fileName: string, csvContent: string, cardCount: number): Promise<void> {
    const decks = await this.getRecentDecks()
    const filtered = decks.filter((d) => d.fileName !== fileName)
    const entry: RecentDeck = {
      fileName,
      csvContent,
      cardCount,
      loadedAt: new Date().toISOString(),
    }
    const updated = [entry, ...filtered].slice(0, MAX_RECENT_DECKS)
    return new Promise((resolve) => {
      chrome.storage.local.set({ [RECENT_DECKS_KEY]: updated }, resolve)
    })
  },

  async removeRecentDeck(fileName: string): Promise<void> {
    const decks = await this.getRecentDecks()
    const updated = decks.filter((d) => d.fileName !== fileName)
    return new Promise((resolve) => {
      chrome.storage.local.set({ [RECENT_DECKS_KEY]: updated }, resolve)
    })
  },

  async getCardFilters(): Promise<CardFilters | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(CARD_FILTERS_KEY, (result) => {
        resolve((result[CARD_FILTERS_KEY] as CardFilters) ?? null)
      })
    })
  },

  async saveCardFilters(filters: CardFilters): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [CARD_FILTERS_KEY]: filters }, resolve)
    })
  },

  async getSearchResults(deckFileName: string): Promise<PersistedSearchResults | null> {
    const key = SEARCH_RESULTS_PREFIX + deckFileName
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve((result[key] as PersistedSearchResults) ?? null)
      })
    })
  },

  async saveSearchResults(results: PersistedSearchResults): Promise<void> {
    const key = SEARCH_RESULTS_PREFIX + results.deckFileName
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: results }, resolve)
    })
  },

  async removeSearchResults(deckFileName: string): Promise<void> {
    const key = SEARCH_RESULTS_PREFIX + deckFileName
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve)
    })
  },
}

import type { RecentDeck } from '../types/models'

const RECENT_DECKS_KEY = 'recentDecks'
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
}

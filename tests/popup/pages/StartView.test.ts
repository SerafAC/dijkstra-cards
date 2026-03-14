// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('@/popup/services/cardService', () => ({
  CardService: {
    LoadCards: vi.fn(),
    LoadFromRecent: vi.fn(),
  },
}))

vi.mock('@/popup/services/storageService', () => ({
  StorageService: {
    getRecentDecks: vi.fn(),
    getRecentProjects: vi.fn(),
    removeRecentDeck: vi.fn(),
    removeRecentProject: vi.fn(),
  },
}))

vi.mock('@/popup/services/projectService', () => ({
  ProjectService: {
    open: vi.fn(),
    restoreProject: vi.fn(),
  },
}))

import StartView from '@/popup/pages/StartView.vue'
import { CardService } from '@/popup/services/cardService'
import { StorageService } from '@/popup/services/storageService'
import { ProjectService } from '@/popup/services/projectService'
import Button from 'primevue/button'
import type { RecentDeck, RecentProject } from '@/popup/types/models'

const mockDeck: RecentDeck = {
  fileName: 'deck.csv',
  csvContent: 'Quantity,CardName\n1,Lightning Bolt',
  cardCount: 1,
  loadedAt: '2026-01-01T00:00:00.000Z',
}

const mockProject: RecentProject = {
  fileName: 'project.dcproject.json',
  projectContent: JSON.stringify({ version: 1, deckFileName: 'deck.csv' }),
  cardCount: 2,
  loadedAt: '2026-01-02T00:00:00.000Z',
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/deck', component: { template: '<div />' } },
    ],
  })
}

function mountComponent(router = makeRouter()) {
  return shallowMount(StartView, {
    global: {
      plugins: [router],
      directives: { tooltip: { mounted: vi.fn() } },
    },
  })
}

describe('StartView', () => {
  beforeEach(() => {
    vi.mocked(StorageService.getRecentDecks).mockResolvedValue([])
    vi.mocked(StorageService.getRecentProjects).mockResolvedValue([])
    vi.mocked(StorageService.removeRecentDeck).mockResolvedValue(undefined)
    vi.mocked(StorageService.removeRecentProject).mockResolvedValue(undefined)
  })

  describe('onMounted', () => {
    it('loads recent decks and projects', async () => {
      mountComponent()
      await flushPromises()

      expect(StorageService.getRecentDecks).toHaveBeenCalledOnce()
      expect(StorageService.getRecentProjects).toHaveBeenCalledOnce()
    })

    it('populates recentItems with merged recent items', async () => {
      vi.mocked(StorageService.getRecentDecks).mockResolvedValue([mockDeck])
      vi.mocked(StorageService.getRecentProjects).mockResolvedValue([mockProject])

      const wrapper = mountComponent()
      await flushPromises()

      expect((wrapper.vm as unknown as { recentItems: unknown[] }).recentItems).toHaveLength(2)
    })
  })

  describe('recentItems computed', () => {
    it('merges decks and projects tagged with their kind', async () => {
      vi.mocked(StorageService.getRecentDecks).mockResolvedValue([mockDeck])
      vi.mocked(StorageService.getRecentProjects).mockResolvedValue([mockProject])

      const wrapper = mountComponent()
      await flushPromises()

      const items = (wrapper.vm as unknown as { recentItems: Array<{ kind: string; fileName: string }> }).recentItems

      const deck = items.find((i) => i.fileName === 'deck.csv')
      const project = items.find((i) => i.fileName === 'project.dcproject.json')

      expect(deck?.kind).toBe('deck')
      expect(project?.kind).toBe('project')
    })

    it('sorts items by loadedAt descending', async () => {
      const older: RecentDeck = { ...mockDeck, loadedAt: '2026-01-01T00:00:00.000Z' }
      const newer: RecentProject = { ...mockProject, loadedAt: '2026-01-03T00:00:00.000Z' }

      vi.mocked(StorageService.getRecentDecks).mockResolvedValue([older])
      vi.mocked(StorageService.getRecentProjects).mockResolvedValue([newer])

      const wrapper = mountComponent()
      await flushPromises()

      const items = (wrapper.vm as unknown as { recentItems: Array<{ fileName: string }> }).recentItems

      expect(items[0].fileName).toBe('project.dcproject.json')
      expect(items[1].fileName).toBe('deck.csv')
    })
  })

  describe('onOpenDeck', () => {
    it('navigates to /deck when LoadCards succeeds', async () => {
      vi.mocked(CardService.LoadCards).mockResolvedValue(true as never)
      vi.mocked(StorageService.getRecentDecks).mockResolvedValue([mockDeck])

      const router = makeRouter()
      const wrapper = mountComponent(router)
      await flushPromises()

      const [openDeckBtn] = wrapper.findAllComponents(Button)
      await openDeckBtn.vm.$emit('click')
      await flushPromises()

      expect(CardService.LoadCards).toHaveBeenCalledOnce()
      expect(router.currentRoute.value.path).toBe('/deck')
    })

    it('does not navigate when LoadCards returns falsy', async () => {
      vi.mocked(CardService.LoadCards).mockResolvedValue(false as never)

      const router = makeRouter()
      const wrapper = mountComponent(router)
      await flushPromises()

      const [openDeckBtn] = wrapper.findAllComponents(Button)
      await openDeckBtn.vm.$emit('click')
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/')
    })

    it('shows an error message when LoadCards throws', async () => {
      vi.mocked(CardService.LoadCards).mockRejectedValue('read error')

      const wrapper = mountComponent()
      await flushPromises()

      const [openDeckBtn] = wrapper.findAllComponents(Button)
      await openDeckBtn.vm.$emit('click')
      await flushPromises()

      expect(wrapper.findComponent({ name: 'Message' }).exists()).toBe(true)
    })
  })

  describe('onOpenProject', () => {
    it('navigates to /deck when ProjectService.open succeeds', async () => {
      vi.mocked(ProjectService.open).mockResolvedValue(true as never)
      vi.mocked(StorageService.getRecentProjects).mockResolvedValue([mockProject])

      const router = makeRouter()
      const wrapper = mountComponent(router)
      await flushPromises()

      const buttons = wrapper.findAllComponents(Button)
      const openProjectBtn = buttons[1]
      await openProjectBtn.vm.$emit('click')
      await flushPromises()

      expect(ProjectService.open).toHaveBeenCalledOnce()
      expect(router.currentRoute.value.path).toBe('/deck')
    })

    it('does not navigate when ProjectService.open returns falsy', async () => {
      vi.mocked(ProjectService.open).mockResolvedValue(false as never)

      const router = makeRouter()
      const wrapper = mountComponent(router)
      await flushPromises()

      const buttons = wrapper.findAllComponents(Button)
      await buttons[1].vm.$emit('click')
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/')
    })

    it('shows an error message when ProjectService.open throws', async () => {
      vi.mocked(ProjectService.open).mockRejectedValue('permission denied')

      const wrapper = mountComponent()
      await flushPromises()

      const buttons = wrapper.findAllComponents(Button)
      await buttons[1].vm.$emit('click')
      await flushPromises()

      expect(wrapper.findComponent({ name: 'Message' }).exists()).toBe(true)
    })
  })

  describe('onOpenRecent', () => {
    it('calls LoadFromRecent with deck content and filename', async () => {
      vi.mocked(CardService.LoadFromRecent).mockResolvedValue(true as never)
      vi.mocked(StorageService.getRecentDecks).mockResolvedValue([mockDeck])

      const wrapper = mountComponent()
      await flushPromises()

      await (wrapper.vm as unknown as { onOpenRecent: (d: RecentDeck) => Promise<void> }).onOpenRecent(mockDeck)
      await flushPromises()

      expect(CardService.LoadFromRecent).toHaveBeenCalledWith(mockDeck.csvContent, mockDeck.fileName)
    })

    it('navigates to /deck on success', async () => {
      vi.mocked(CardService.LoadFromRecent).mockResolvedValue(true as never)

      const router = makeRouter()
      const wrapper = mountComponent(router)
      await flushPromises()

      await (wrapper.vm as unknown as { onOpenRecent: (d: RecentDeck) => Promise<void> }).onOpenRecent(mockDeck)
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/deck')
    })

    it('shows error when LoadFromRecent returns false', async () => {
      vi.mocked(CardService.LoadFromRecent).mockResolvedValue(false as never)

      const wrapper = mountComponent()
      await flushPromises()

      await (wrapper.vm as unknown as { onOpenRecent: (d: RecentDeck) => Promise<void> }).onOpenRecent(mockDeck)
      await flushPromises()

      expect(wrapper.findComponent({ name: 'Message' }).exists()).toBe(true)
    })
  })

  describe('onRemoveRecent', () => {
    it('removes the deck and refreshes the list', async () => {
      vi.mocked(StorageService.getRecentDecks).mockResolvedValue([mockDeck])

      const wrapper = mountComponent()
      await flushPromises()

      vi.mocked(StorageService.getRecentDecks).mockResolvedValue([])
      await (wrapper.vm as unknown as { onRemoveRecent: (d: RecentDeck) => Promise<void> }).onRemoveRecent(mockDeck)
      await flushPromises()

      expect(StorageService.removeRecentDeck).toHaveBeenCalledWith(mockDeck.fileName)
      expect((wrapper.vm as unknown as { recentItems: unknown[] }).recentItems).toHaveLength(0)
    })
  })

  describe('onOpenRecentProject', () => {
    it('calls restoreProject with parsed project content', async () => {
      vi.mocked(ProjectService.restoreProject).mockResolvedValue(true as never)

      const wrapper = mountComponent()
      await flushPromises()

      await (wrapper.vm as unknown as { onOpenRecentProject: (p: RecentProject) => Promise<void> }).onOpenRecentProject(mockProject)
      await flushPromises()

      expect(ProjectService.restoreProject).toHaveBeenCalledWith(JSON.parse(mockProject.projectContent))
    })

    it('navigates to /deck on success', async () => {
      vi.mocked(ProjectService.restoreProject).mockResolvedValue(true as never)

      const router = makeRouter()
      const wrapper = mountComponent(router)
      await flushPromises()

      await (wrapper.vm as unknown as { onOpenRecentProject: (p: RecentProject) => Promise<void> }).onOpenRecentProject(mockProject)
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/deck')
    })

    it('shows error when restoreProject returns false', async () => {
      vi.mocked(ProjectService.restoreProject).mockResolvedValue(false as never)

      const wrapper = mountComponent()
      await flushPromises()

      await (wrapper.vm as unknown as { onOpenRecentProject: (p: RecentProject) => Promise<void> }).onOpenRecentProject(mockProject)
      await flushPromises()

      expect(wrapper.findComponent({ name: 'Message' }).exists()).toBe(true)
    })
  })

  describe('onRemoveRecentProject', () => {
    it('removes the project and refreshes the list', async () => {
      vi.mocked(StorageService.getRecentProjects).mockResolvedValue([mockProject])

      const wrapper = mountComponent()
      await flushPromises()

      vi.mocked(StorageService.getRecentProjects).mockResolvedValue([])
      await (wrapper.vm as unknown as { onRemoveRecentProject: (p: RecentProject) => Promise<void> }).onRemoveRecentProject(mockProject)
      await flushPromises()

      expect(StorageService.removeRecentProject).toHaveBeenCalledWith(mockProject.fileName)
    })
  })

  describe('onOpenItem', () => {
    it('delegates to onOpenRecent for deck items', async () => {
      vi.mocked(CardService.LoadFromRecent).mockResolvedValue(true as never)

      const router = makeRouter()
      const wrapper = mountComponent(router)
      await flushPromises()

      const vm = wrapper.vm as unknown as {
        onOpenItem: (item: { kind: string } & (RecentDeck | RecentProject)) => Promise<void>
      }
      await vm.onOpenItem({ kind: 'deck', ...mockDeck })
      await flushPromises()

      expect(CardService.LoadFromRecent).toHaveBeenCalledWith(mockDeck.csvContent, mockDeck.fileName)
    })

    it('delegates to onOpenRecentProject for project items', async () => {
      vi.mocked(ProjectService.restoreProject).mockResolvedValue(true as never)

      const router = makeRouter()
      const wrapper = mountComponent(router)
      await flushPromises()

      const vm = wrapper.vm as unknown as {
        onOpenItem: (item: { kind: string } & (RecentDeck | RecentProject)) => Promise<void>
      }
      await vm.onOpenItem({ kind: 'project', ...mockProject })
      await flushPromises()

      expect(ProjectService.restoreProject).toHaveBeenCalledWith(JSON.parse(mockProject.projectContent))
    })
  })

  describe('onRemoveItem', () => {
    it('delegates to onRemoveRecent for deck items', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      const vm = wrapper.vm as unknown as {
        onRemoveItem: (item: { kind: string } & (RecentDeck | RecentProject)) => Promise<void>
      }
      await vm.onRemoveItem({ kind: 'deck', ...mockDeck })
      await flushPromises()

      expect(StorageService.removeRecentDeck).toHaveBeenCalledWith(mockDeck.fileName)
    })

    it('delegates to onRemoveRecentProject for project items', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      const vm = wrapper.vm as unknown as {
        onRemoveItem: (item: { kind: string } & (RecentDeck | RecentProject)) => Promise<void>
      }
      await vm.onRemoveItem({ kind: 'project', ...mockProject })
      await flushPromises()

      expect(StorageService.removeRecentProject).toHaveBeenCalledWith(mockProject.fileName)
    })
  })

  describe('formatDate', () => {
    it('formats an ISO date string to a localised date', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      const vm = wrapper.vm as unknown as { formatDate: (iso: string) => string }
      const result = vm.formatDate('2026-01-15T00:00:00.000Z')

      expect(result).toMatch(/2026/)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })
})

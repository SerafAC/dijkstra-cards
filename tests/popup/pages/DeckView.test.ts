// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import type { Card } from '@/popup/types/models'

const mockSaveSelectedCards = vi.fn()
const mockGetStoredDeckFileName = vi.fn(() => 'test-deck.csv')
const mockOpenURL = vi.fn()

const allCardsRef = ref<Card[]>([])
const selectedCardsRef = ref<Card[]>([])

vi.mock('@/popup/stores/cardsStore', () => ({
  useAllCards: () => allCardsRef,
  useSelectedCards: () => selectedCardsRef,
  saveSelectedCards: (...args: unknown[]) => mockSaveSelectedCards(...args),
  getStoredDeckFileName: () => mockGetStoredDeckFileName(),
}))

vi.mock('@/popup/services/browser', () => ({
  Browser: { OpenURL: (...args: unknown[]) => mockOpenURL(...args) },
}))

import DeckView from '@/popup/pages/DeckView.vue'

const mockCard1: Card = {
  Id: 'uuid-1',
  Quantity: 2,
  CardName: 'Lightning Bolt',
  EditionName: 'Alpha',
  Link: 'https://cardmarket.com/1',
}

const mockCard2: Card = {
  Id: 'uuid-2',
  Quantity: 1,
  CardName: 'Dark Ritual',
  EditionName: 'Beta',
  Link: 'https://cardmarket.com/2',
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/deck', component: { template: '<div />' } },
      { path: '/search', component: { template: '<div />' } },
    ],
  })
}

function mountComponent(router = makeRouter()) {
  return shallowMount(DeckView, {
    global: {
      plugins: [router],
      directives: { tooltip: { mounted: vi.fn() } },
    },
  })
}

type DeckViewVm = {
  selectedCards: Card[]
  handleNext: () => void
}

function vm(wrapper: ReturnType<typeof mountComponent>): DeckViewVm {
  return wrapper.vm as unknown as DeckViewVm
}

function nextButton(wrapper: ReturnType<typeof mountComponent>) {
  return wrapper.findAllComponents(Button)[0]
}

describe('DeckView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    allCardsRef.value = []
    selectedCardsRef.value = []
    mockGetStoredDeckFileName.mockReturnValue('test-deck.csv')
  })

  describe('rendering', () => {
    it('renders the Deck Viewer heading', () => {
      const wrapper = mountComponent()

      expect(wrapper.text()).toContain('Deck Viewer')
    })

    it('renders the Next button', () => {
      const wrapper = mountComponent()

      expect(wrapper.findAllComponents(Button).length).toBeGreaterThanOrEqual(1)
    })

    it('renders the DataTable when cards are present', () => {
      allCardsRef.value = [mockCard1, mockCard2]
      const wrapper = mountComponent()

      expect(wrapper.findComponent(DataTable).exists()).toBe(true)
    })

    it('hides the DataTable when no cards are loaded', () => {
      allCardsRef.value = []
      const wrapper = mountComponent()

      expect(wrapper.findComponent(DataTable).exists()).toBe(false)
    })
  })

  describe('selectedCards state', () => {
    it('is empty when no cards were previously selected', () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = []
      const wrapper = mountComponent()

      expect(vm(wrapper).selectedCards).toHaveLength(0)
    })

    it('is populated on mount from the stored selection', async () => {
      allCardsRef.value = [mockCard1, mockCard2]
      selectedCardsRef.value = [mockCard1]
      const wrapper = mountComponent()
      await flushPromises()

      expect(vm(wrapper).selectedCards).toHaveLength(1)
      expect(vm(wrapper).selectedCards[0].Id).toBe('uuid-1')
    })

    it('ignores stored cards whose IDs are not in allCards', async () => {
      const orphan: Card = { Id: 'uuid-99', Quantity: 1, CardName: 'Orphan', EditionName: '', Link: '' }
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = [orphan]
      const wrapper = mountComponent()
      await flushPromises()

      expect(vm(wrapper).selectedCards).toHaveLength(0)
    })
  })

  describe('onMounted – card restoration', () => {
    it('does not modify allCards when no cards were previously selected', async () => {
      allCardsRef.value = [{ ...mockCard1 }]
      selectedCardsRef.value = []
      mountComponent()
      await flushPromises()

      expect(allCardsRef.value[0].LastUpdated).toBeUndefined()
    })

    it('copies LastUpdated from stored cards onto allCards entries', async () => {
      const storedCard = { ...mockCard1, LastUpdated: '2024-06-01T12:00:00Z' }
      allCardsRef.value = [{ ...mockCard1 }]
      selectedCardsRef.value = [storedCard]
      mountComponent()
      await flushPromises()

      expect(allCardsRef.value[0].LastUpdated).toBe('2024-06-01T12:00:00Z')
    })

    it('does not overwrite an existing LastUpdated when the stored card has none', async () => {
      const cardWithDate: Card = { ...mockCard1, LastUpdated: '2024-01-01T00:00:00Z' }
      allCardsRef.value = [cardWithDate]
      selectedCardsRef.value = [{ ...mockCard1 }] // no LastUpdated
      mountComponent()
      await flushPromises()

      expect(allCardsRef.value[0].LastUpdated).toBe('2024-01-01T00:00:00Z')
    })
  })

  describe('handleNext', () => {
    it('does not save or navigate when no cards are selected', async () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = []
      const router = makeRouter()
      const wrapper = mountComponent(router)

      vm(wrapper).handleNext()
      await flushPromises()

      expect(mockSaveSelectedCards).not.toHaveBeenCalled()
      expect(router.currentRoute.value.path).not.toBe('/search')
    })

    it('saves selected cards and navigates to /search', async () => {
      allCardsRef.value = [mockCard1, mockCard2]
      selectedCardsRef.value = [mockCard1]
      const router = makeRouter()
      const wrapper = mountComponent(router)
      await flushPromises()

      await nextButton(wrapper).vm.$emit('click')
      await flushPromises()

      expect(mockSaveSelectedCards).toHaveBeenCalledWith([mockCard1], 'test-deck.csv')
      expect(router.currentRoute.value.path).toBe('/search')
    })

    it('passes the current deck filename from the store', async () => {
      mockGetStoredDeckFileName.mockReturnValue('my-deck.csv')
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = [mockCard1]
      const wrapper = mountComponent()
      await flushPromises()

      await nextButton(wrapper).vm.$emit('click')
      await flushPromises()

      expect(mockSaveSelectedCards).toHaveBeenCalledWith([mockCard1], 'my-deck.csv')
    })
  })

  describe('onBeforeUnmount – auto-save', () => {
    it('saves current selection on unmount when not navigating to search', async () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = [mockCard1]
      const wrapper = mountComponent()
      await flushPromises()

      wrapper.unmount()

      expect(mockSaveSelectedCards).toHaveBeenCalledWith([mockCard1], 'test-deck.csv')
    })

    it('saves an empty selection on unmount when no cards were selected', () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = []
      const wrapper = mountComponent()

      wrapper.unmount()

      expect(mockSaveSelectedCards).toHaveBeenCalledWith([], 'test-deck.csv')
    })

    it('does not save again on unmount after handleNext was called', async () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = [mockCard1]
      const wrapper = mountComponent()
      await flushPromises()

      await nextButton(wrapper).vm.$emit('click')
      await flushPromises()
      mockSaveSelectedCards.mockClear()

      wrapper.unmount()

      expect(mockSaveSelectedCards).not.toHaveBeenCalled()
    })
  })
})

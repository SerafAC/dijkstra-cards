// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import type { Card } from '@/popup/types/models'

const mockPush = vi.fn()
const mockSaveSelectedCards = vi.fn()
const mockGetStoredDeckFileName = vi.fn(() => 'test-deck.csv')
const mockOpenURL = vi.fn()

const allCardsRef = ref<Card[]>([])
const selectedCardsRef = ref<Card[]>([])

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  RouterLink: { template: '<a><slot /></a>', props: ['to'] },
}))

vi.mock('@/popup/stores/cardsStore', () => ({
  useAllCards: () => allCardsRef,
  useSelectedCards: () => selectedCardsRef,
  saveSelectedCards: (...args: unknown[]) => mockSaveSelectedCards(...args),
  getStoredDeckFileName: () => mockGetStoredDeckFileName(),
}))

vi.mock('@/popup/services/browser', () => ({
  Browser: { OpenURL: (...args: unknown[]) => mockOpenURL(...args) },
}))

// Stub PrimeVue components to avoid their complex rendering in tests
const ButtonStub = {
  template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
  props: ['label', 'icon', 'severity', 'disabled', 'size', 'outlined'],
  emits: ['click'],
}

const DataTableStub = {
  template: '<div class="data-table"><slot /></div>',
  props: ['value', 'selection', 'selectionMode', 'sortField', 'sortOrder', 'size', 'scrollable', 'scrollHeight'],
  emits: ['update:selection'],
}

const ColumnStub = {
  template: '<div />',
  props: ['field', 'header', 'sortable', 'selectionMode', 'headerStyle'],
}

const MessageStub = {
  template: '<div class="message"><slot /></div>',
  props: ['severity', 'closable'],
  emits: ['close'],
}

const globalConfig = {
  stubs: {
    Button: ButtonStub,
    DataTable: DataTableStub,
    Column: ColumnStub,
    Message: MessageStub,
  },
}

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

// Import after mocks are set up
import DeckView from '@/popup/pages/DeckView.vue'

describe('DeckView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    allCardsRef.value = []
    selectedCardsRef.value = []
    mockGetStoredDeckFileName.mockReturnValue('test-deck.csv')
  })

  describe('rendering', () => {
    it('renders the Deck Viewer heading', () => {
      const wrapper = mount(DeckView, { global: globalConfig })

      expect(wrapper.text()).toContain('Deck Viewer')
    })

    it('renders the Next button', () => {
      const wrapper = mount(DeckView, { global: globalConfig })

      expect(wrapper.find('button.btn-next').exists()).toBe(true)
    })

    it('renders the Back to Start link', () => {
      const wrapper = mount(DeckView, { global: globalConfig })

      expect(wrapper.text()).toContain('Back to Start')
    })

    it('does not render an error message by default', () => {
      const wrapper = mount(DeckView, { global: globalConfig })

      expect(wrapper.find('.message').exists()).toBe(false)
    })

    it('renders the DataTable when cards are present', () => {
      allCardsRef.value = [mockCard1, mockCard2]
      const wrapper = mount(DeckView, { global: globalConfig })

      expect(wrapper.find('.data-table').exists()).toBe(true)
    })

    it('does not render the DataTable when no cards are loaded', () => {
      allCardsRef.value = []
      const wrapper = mount(DeckView, { global: globalConfig })

      expect(wrapper.find('.data-table').exists()).toBe(false)
    })
  })

  describe('Next button disabled state', () => {
    it('is disabled when no cards are selected', () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = []
      const wrapper = mount(DeckView, { global: globalConfig })

      expect(wrapper.find('button.btn-next').attributes('disabled')).toBeDefined()
    })

    it('is enabled when cards are restored from store on mount', async () => {
      allCardsRef.value = [mockCard1, mockCard2]
      selectedCardsRef.value = [mockCard1]
      const wrapper = mount(DeckView, { global: globalConfig })
      await flushPromises()

      expect(wrapper.find('button.btn-next').attributes('disabled')).toBeUndefined()
    })

    it('remains disabled when stored cards have no matching ids in allCards', async () => {
      const orphan: Card = { Id: 'uuid-99', Quantity: 1, CardName: 'Orphan', EditionName: '', Link: '' }
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = [orphan]
      const wrapper = mount(DeckView, { global: globalConfig })
      await flushPromises()

      expect(wrapper.find('button.btn-next').attributes('disabled')).toBeDefined()
    })
  })

  describe('onMounted – card restoration', () => {
    it('skips restoration when no cards were previously selected', async () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = []
      mount(DeckView, { global: globalConfig })
      await flushPromises()

      // No cards were restored; allCards remain untouched
      expect(allCardsRef.value[0].LastUpdated).toBeUndefined()
    })

    it('restores only cards present in allCards', async () => {
      const orphan: Card = { Id: 'uuid-99', Quantity: 1, CardName: 'Orphan', EditionName: '', Link: '' }
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = [mockCard1, orphan]
      const wrapper = mount(DeckView, { global: globalConfig })
      await flushPromises()

      // Only mockCard1 is in allCards, so only it is restored (button enabled)
      expect(wrapper.find('button.btn-next').attributes('disabled')).toBeUndefined()
    })

    it('copies LastUpdated from stored cards onto allCards entries', async () => {
      const storedCard = { ...mockCard1, LastUpdated: '2024-06-01T12:00:00Z' }
      allCardsRef.value = [{ ...mockCard1 }]
      selectedCardsRef.value = [storedCard]
      mount(DeckView, { global: globalConfig })
      await flushPromises()

      expect(allCardsRef.value[0].LastUpdated).toBe('2024-06-01T12:00:00Z')
    })

    it('does not overwrite LastUpdated when stored card has none', async () => {
      const cardWithDate = { ...mockCard1, LastUpdated: '2024-01-01T00:00:00Z' }
      allCardsRef.value = [cardWithDate]
      selectedCardsRef.value = [{ ...mockCard1 }] // stored card has no LastUpdated
      mount(DeckView, { global: globalConfig })
      await flushPromises()

      // LastUpdated on allCards is unchanged because stored.LastUpdated is falsy
      expect(allCardsRef.value[0].LastUpdated).toBe('2024-01-01T00:00:00Z')
    })
  })

  describe('handleNext', () => {
    it('does not save or navigate when no cards are selected', async () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = []
      const wrapper = mount(DeckView, { global: globalConfig })

      // Directly invoke handleNext via the vm (the button is disabled but we test the guard)
      await (wrapper.vm as unknown as { handleNext: () => void }).handleNext?.()

      expect(mockSaveSelectedCards).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('saves selected cards and navigates to /search when cards are selected', async () => {
      allCardsRef.value = [mockCard1, mockCard2]
      selectedCardsRef.value = [mockCard1]
      const wrapper = mount(DeckView, { global: globalConfig })
      await flushPromises()

      await wrapper.find('button.btn-next').trigger('click')

      expect(mockSaveSelectedCards).toHaveBeenCalledWith([mockCard1], 'test-deck.csv')
      expect(mockPush).toHaveBeenCalledWith('/search')
    })

    it('passes the current deck filename from the store', async () => {
      mockGetStoredDeckFileName.mockReturnValue('my-deck.csv')
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = [mockCard1]
      const wrapper = mount(DeckView, { global: globalConfig })
      await flushPromises()

      await wrapper.find('button.btn-next').trigger('click')

      expect(mockSaveSelectedCards).toHaveBeenCalledWith([mockCard1], 'my-deck.csv')
    })
  })

  describe('onBeforeUnmount – auto-save', () => {
    it('saves current selection on unmount when not navigating to search', async () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = [mockCard1]
      const wrapper = mount(DeckView, { global: globalConfig })
      await flushPromises()

      wrapper.unmount()

      expect(mockSaveSelectedCards).toHaveBeenCalledWith([mockCard1], 'test-deck.csv')
    })

    it('saves an empty selection on unmount when no cards were selected', () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = []
      const wrapper = mount(DeckView, { global: globalConfig })

      wrapper.unmount()

      expect(mockSaveSelectedCards).toHaveBeenCalledWith([], 'test-deck.csv')
    })

    it('does not save again on unmount after navigating to search', async () => {
      allCardsRef.value = [mockCard1]
      selectedCardsRef.value = [mockCard1]
      const wrapper = mount(DeckView, { global: globalConfig })
      await flushPromises()

      // Navigate to search (sets navigatingToSearch = true internally)
      await wrapper.find('button.btn-next').trigger('click')
      mockSaveSelectedCards.mockClear()

      wrapper.unmount()

      expect(mockSaveSelectedCards).not.toHaveBeenCalled()
    })
  })
})

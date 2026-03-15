// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref, computed } from 'vue'
import type {
  Card,
  Seller,
  PersistedSearchResults,
  CardFilters,
} from '@/popup/types/models'

const mockGetCardSellers = vi.fn()
const mockCloseBrowsingSession = vi.fn()
const mockParseSellerListings = vi.fn()
const mockReadTabHtml = vi.fn()
const mockFindOptimalSellers = vi.fn()
const mockGetStoredDeckFileName = vi.fn(() => 'test-deck.csv')
const mockClearSelectedCards = vi.fn()
const mockOpenURL = vi.fn()
const mockTabsQuery = vi.fn()

const allCardsRef = ref<Card[]>([])
const selectedCardsRef = ref<Card[]>([])

const mockProjectFileHandle = ref<FileSystemFileHandle | null>(null)
const mockProjectFileName = ref('')

vi.mock('@/popup/stores/cardsStore', () => ({
  useAllCards: () => allCardsRef,
  useSelectedCards: () => selectedCardsRef,
  getStoredDeckFileName: () => mockGetStoredDeckFileName(),
  clearSelectedCards: () => mockClearSelectedCards(),
}))

vi.mock('@/popup/stores/projectStore', () => ({
  useProjectStore: () => ({
    isProjectLoaded: computed(
      () => !!mockProjectFileHandle.value || !!mockProjectFileName.value,
    ),
    currentProjectName: computed(() => mockProjectFileName.value),
    projectFileHandle: mockProjectFileHandle,
    projectFileName: mockProjectFileName,
  }),
}))

vi.mock('@/popup/services/cardmarketService', () => ({
  GetCardSellers: (...args: unknown[]) => mockGetCardSellers(...args),
  closeBrowsingSession: () => mockCloseBrowsingSession(),
  ParseSellerListings: (...args: unknown[]) => mockParseSellerListings(...args),
}))

vi.mock('@/popup/services/tabFetchService', () => ({
  readTabHtml: (...args: unknown[]) => mockReadTabHtml(...args),
}))

vi.mock('@/popup/services/sellerAssignmentService', () => ({
  FindOptimalSellers: (...args: unknown[]) => mockFindOptimalSellers(...args),
}))

vi.mock('@/popup/services/storageService', () => ({
  StorageService: {
    getCardFilters: vi.fn(),
    saveCardFilters: vi.fn(),
    getSearchResults: vi.fn(),
    saveSearchResults: vi.fn(),
    removeSearchResults: vi.fn(),
  },
}))

vi.mock('@/popup/services/projectService', () => ({
  ProjectService: {
    autoSave: vi.fn(),
    saveAs: vi.fn(),
  },
}))

vi.mock('@/popup/services/browser', () => ({
  Browser: { OpenURL: (...args: unknown[]) => mockOpenURL(...args) },
}))

vi.mock('@/popup/utils/dateUtils', () => ({
  lastUpdatedColor: () => 'green',
  formatDate: (d?: string) => d ?? '-',
}))

import SearchCardsPage from '@/popup/pages/SearchCardsPage.vue'
import { StorageService } from '@/popup/services/storageService'
import { ProjectService } from '@/popup/services/projectService'
import ProgressBar from 'primevue/progressbar'

const mockSeller1: Seller = {
  SellerName: 'ShopA',
  SellerCountry: 'Germany',
  SellerCountryId: 7,
  CardCondition: 'Near Mint',
  CardsAmmount: 5,
  Price: 1.5,
  Currency: 'EUR',
}

const mockSeller2: Seller = {
  SellerName: 'ShopB',
  SellerCountry: 'France',
  SellerCountryId: 12,
  CardCondition: 'Excellent',
  CardsAmmount: 3,
  Price: 2.0,
  Currency: 'EUR',
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

const mockCard3: Card = {
  Id: 'uuid-3',
  Quantity: 1,
  CardName: 'Counterspell',
  EditionName: 'Alpha',
  Link: 'https://cardmarket.com/3',
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/deck', component: { template: '<div />' } },
      { path: '/search', component: { template: '<div />' } },
    ],
  })
}

function mountComponent(router = makeRouter()) {
  return shallowMount(SearchCardsPage, {
    global: {
      plugins: [router],
      directives: { tooltip: { mounted: vi.fn() } },
    },
  })
}

type SearchVm = {
  assignments: Record<string, Seller>
  cardFetchErrors: Array<{
    cardId: string
    hadError: boolean
    errorMessage?: string
    sellersFound: boolean
    fetchAttempted: boolean
  }>
  isSearching: boolean
  searchAttempted: boolean
  selectedLanguages: number[]
  selectedMinCondition: number | null
  selectedSellerCountries: number[]
  assignmentRows: Array<{
    id?: string
    cardName: string
    setName: string
    sellerName: string
    price: number
    link: string
  }>
  totalPrice: number
  assignedCardsCount: number
  uniqueSellersCount: number
  failedCards: Array<{
    id?: string
    cardName: string
    setName: string
    sellersFound: boolean
    errorMessage: string
  }>
  pendingCards: Array<{ id: string; cardName: string; setName: string }>
  hasCards: boolean
  hasAssignments: boolean
  hasFailedCards: boolean
  hasPendingCards: boolean
  fetchProgress: number
  fetchTotal: number
  fetchPercentage: number
  failedSectionCollapsed: boolean
  replaceModalVisible: boolean
  replaceTargetCardId: string | null
  replaceError: string | null
  replaceErrorModalVisible: boolean
  isReplacing: boolean
  assignSellers: () => Promise<void>
  reloadCardSellers: (id: string) => Promise<void>
  retrySearch: (id: string) => Promise<void>
  removeAssignments: () => Promise<void>
  saveFilters: () => Promise<void>
  clearSavedFilters: () => Promise<void>
  saveProjectAs: () => Promise<void>
  goBack: () => void
  resetSelection: () => void
  openReplaceModal: (cardId: string) => void
  closeReplaceModal: () => void
  searchReplacementCard: () => void
  handleReplace: () => Promise<void>
  parseCardNameFromUrl: (url: string) => { cardName: string; editionName: string }
}

function vm(wrapper: ReturnType<typeof mountComponent>): SearchVm {
  return wrapper.vm as unknown as SearchVm
}

describe('SearchCardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    allCardsRef.value = []
    selectedCardsRef.value = []
    mockProjectFileHandle.value = null
    mockProjectFileName.value = ''
    mockGetStoredDeckFileName.mockReturnValue('test-deck.csv')
    vi.mocked(StorageService.getCardFilters).mockResolvedValue(null)
    vi.mocked(StorageService.getSearchResults).mockResolvedValue(null)
    vi.mocked(StorageService.saveSearchResults).mockResolvedValue(undefined)
    vi.mocked(StorageService.saveCardFilters).mockResolvedValue(undefined)
    vi.mocked(StorageService.removeSearchResults).mockResolvedValue(undefined)
    vi.mocked(ProjectService.autoSave).mockResolvedValue(undefined)
    vi.mocked(ProjectService.saveAs).mockResolvedValue(undefined)
    mockFindOptimalSellers.mockResolvedValue({})
    mockGetCardSellers.mockResolvedValue([])
    mockReadTabHtml.mockResolvedValue('<html></html>')
    mockParseSellerListings.mockReturnValue([])
    mockTabsQuery.mockImplementation(
      (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]),
    )
    vi.stubGlobal('chrome', { tabs: { query: mockTabsQuery } })
  })

  describe('rendering', () => {
    it('renders the Search Cards heading', async () => {
      selectedCardsRef.value = [mockCard1]
      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.text()).toContain('Search Cards')
    })

    it('shows the empty state when no cards are selected', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('No cards selected')
    })

    it('shows results section when cards are selected', async () => {
      selectedCardsRef.value = [mockCard1]
      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.find('.results').exists()).toBe(true)
      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })

    it('shows placeholder text before search is run', async () => {
      selectedCardsRef.value = [mockCard1]
      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.text()).toContain(
        'Select cards from the deck and click "Assign sellers"',
      )
    })
  })

  describe('onMounted – filter restoration', () => {
    it('restores saved filters on mount', async () => {
      const savedFilters: CardFilters = {
        language: [1, 3],
        minCondition: 2,
        sellerCountry: [7],
      }
      vi.mocked(StorageService.getCardFilters).mockResolvedValue(savedFilters)
      selectedCardsRef.value = [mockCard1]
      const wrapper = mountComponent()
      await flushPromises()

      expect(vm(wrapper).selectedLanguages).toEqual([1, 3])
      expect(vm(wrapper).selectedMinCondition).toBe(2)
      expect(vm(wrapper).selectedSellerCountries).toEqual([7])
    })

    it('leaves filters empty when no saved filters exist', async () => {
      vi.mocked(StorageService.getCardFilters).mockResolvedValue(null)
      selectedCardsRef.value = [mockCard1]
      const wrapper = mountComponent()
      await flushPromises()

      expect(vm(wrapper).selectedLanguages).toEqual([])
      expect(vm(wrapper).selectedMinCondition).toBeNull()
      expect(vm(wrapper).selectedSellerCountries).toEqual([])
    })
  })

  describe('onMounted – restorePersistedResults', () => {
    it('restores assignments from persisted search results', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }, { ...mockCard2 }]
      const saved: PersistedSearchResults = {
        deckFileName: 'test-deck.csv',
        assignments: [
          {
            cardName: 'Lightning Bolt',
            editionName: 'Alpha',
            seller: mockSeller1,
            lastUpdated: '2026-01-01T00:00:00Z',
          },
        ],
        errors: [],
      }
      vi.mocked(StorageService.getSearchResults).mockResolvedValue(saved)

      const wrapper = mountComponent()
      await flushPromises()

      expect(vm(wrapper).assignments['uuid-1']).toEqual(mockSeller1)
      expect(vm(wrapper).searchAttempted).toBe(true)
    })

    it('restores errors from persisted search results', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      const saved: PersistedSearchResults = {
        deckFileName: 'test-deck.csv',
        assignments: [],
        errors: [
          {
            cardName: 'Lightning Bolt',
            editionName: 'Alpha',
            errorMessage: 'Timeout',
          },
        ],
      }
      vi.mocked(StorageService.getSearchResults).mockResolvedValue(saved)

      const wrapper = mountComponent()
      await flushPromises()

      expect(vm(wrapper).cardFetchErrors).toHaveLength(1)
      expect(vm(wrapper).cardFetchErrors[0].errorMessage).toBe('Timeout')
      expect(vm(wrapper).searchAttempted).toBe(true)
    })

    it('does not restore when no deck filename', async () => {
      mockGetStoredDeckFileName.mockReturnValue('')
      selectedCardsRef.value = [mockCard1]

      const wrapper = mountComponent()
      await flushPromises()

      expect(StorageService.getSearchResults).not.toHaveBeenCalled()
      expect(vm(wrapper).searchAttempted).toBe(false)
    })

    it('does not restore when no saved results', async () => {
      vi.mocked(StorageService.getSearchResults).mockResolvedValue(null)
      selectedCardsRef.value = [mockCard1]

      const wrapper = mountComponent()
      await flushPromises()

      expect(Object.keys(vm(wrapper).assignments)).toHaveLength(0)
      expect(vm(wrapper).searchAttempted).toBe(false)
    })

    it('matches cards case-insensitively via cardKey', async () => {
      selectedCardsRef.value = [
        { ...mockCard1, CardName: 'lightning bolt', EditionName: 'alpha' },
      ]
      const saved: PersistedSearchResults = {
        deckFileName: 'test-deck.csv',
        assignments: [
          {
            cardName: 'Lightning Bolt',
            editionName: 'Alpha',
            seller: mockSeller1,
          },
        ],
        errors: [],
      }
      vi.mocked(StorageService.getSearchResults).mockResolvedValue(saved)

      const wrapper = mountComponent()
      await flushPromises()

      expect(vm(wrapper).assignments[mockCard1.Id]).toEqual(mockSeller1)
    })

    it('restores LastUpdated timestamps on cards', async () => {
      const card = { ...mockCard1 }
      selectedCardsRef.value = [card]
      const saved: PersistedSearchResults = {
        deckFileName: 'test-deck.csv',
        assignments: [
          {
            cardName: 'Lightning Bolt',
            editionName: 'Alpha',
            seller: mockSeller1,
            lastUpdated: '2026-03-01T10:00:00Z',
          },
        ],
        errors: [],
      }
      vi.mocked(StorageService.getSearchResults).mockResolvedValue(saved)

      mountComponent()
      await flushPromises()

      expect(card.LastUpdated).toBe('2026-03-01T10:00:00Z')
    })
  })

  describe('assignSellers', () => {
    it('fetches sellers for each card and computes assignments', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }, { ...mockCard2 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({
        'uuid-1': mockSeller1,
        'uuid-2': mockSeller2,
      })

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(mockGetCardSellers).toHaveBeenCalledTimes(2)
      expect(mockFindOptimalSellers).toHaveBeenCalled()
      expect(vm(wrapper).assignments['uuid-1']).toEqual(mockSeller1)
      expect(vm(wrapper).assignments['uuid-2']).toEqual(mockSeller2)
    })

    it('does nothing when no cards are selected', async () => {
      selectedCardsRef.value = []
      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(mockGetCardSellers).not.toHaveBeenCalled()
      expect(Object.keys(vm(wrapper).assignments)).toHaveLength(0)
    })

    it('skips already-assigned cards', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }, { ...mockCard2 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-2': mockSeller2 })

      const wrapper = mountComponent()
      await flushPromises()

      // Pre-assign card1
      vm(wrapper).assignments = { 'uuid-1': mockSeller1 }

      await vm(wrapper).assignSellers()
      await flushPromises()

      // Should only fetch for card2
      expect(mockGetCardSellers).toHaveBeenCalledTimes(1)
      expect(
        mockGetCardSellers.mock.calls[0][0].Card.CardName,
      ).toBe('Dark Ritual')
    })

    it('records errors for failed card fetches', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockRejectedValue(new Error('Network error'))
      mockFindOptimalSellers.mockResolvedValue({})

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(vm(wrapper).cardFetchErrors).toHaveLength(1)
      expect(vm(wrapper).cardFetchErrors[0].errorMessage).toBe('Network error')
      expect(vm(wrapper).cardFetchErrors[0].cardId).toBe('uuid-1')
    })

    it('sets and clears isSearching state', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      const promise = vm(wrapper).assignSellers()
      expect(vm(wrapper).isSearching).toBe(true)

      await promise
      await flushPromises()

      expect(vm(wrapper).isSearching).toBe(false)
    })

    it('closes browsing session after search completes', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([])
      mockFindOptimalSellers.mockResolvedValue({})

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(mockCloseBrowsingSession).toHaveBeenCalled()
    })

    it('persists results after successful search', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(StorageService.saveSearchResults).toHaveBeenCalledWith(
        expect.objectContaining({
          deckFileName: 'test-deck.csv',
          assignments: expect.arrayContaining([
            expect.objectContaining({
              cardName: 'Lightning Bolt',
              seller: mockSeller1,
            }),
          ]),
        }),
      )
    })

    it('tracks fetch progress', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }, { ...mockCard2 }]
      mockGetCardSellers.mockResolvedValue([])
      mockFindOptimalSellers.mockResolvedValue({})

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(vm(wrapper).fetchTotal).toBe(2)
      expect(vm(wrapper).fetchProgress).toBe(2)
    })

    it('sets LastUpdated on newly assigned cards', async () => {
      const card = { ...mockCard1 }
      selectedCardsRef.value = [card]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(card.LastUpdated).toBeDefined()
      expect(new Date(card.LastUpdated!).getTime()).not.toBeNaN()
    })

    it('auto-saves to project when project is loaded', async () => {
      mockProjectFileName.value = 'test.dcproject.json'
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(ProjectService.autoSave).toHaveBeenCalled()
    })

    it('does not auto-save when no project is loaded', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(ProjectService.autoSave).not.toHaveBeenCalled()
    })

    it('returns early when all cards already assigned', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).assignments = { 'uuid-1': mockSeller1 }

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(mockGetCardSellers).not.toHaveBeenCalled()
    })
  })

  describe('reloadCardSellers', () => {
    it('re-fetches sellers and recalculates assignments for a single card', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([mockSeller2])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller2 })

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).assignments = { 'uuid-1': mockSeller1 }

      await vm(wrapper).reloadCardSellers('uuid-1')
      await flushPromises()

      expect(mockGetCardSellers).toHaveBeenCalledTimes(1)
      expect(mockFindOptimalSellers).toHaveBeenCalled()
      expect(vm(wrapper).assignments['uuid-1']).toEqual(mockSeller2)
    })

    it('does nothing for an unknown card ID', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).reloadCardSellers('nonexistent')
      await flushPromises()

      expect(mockGetCardSellers).not.toHaveBeenCalled()
    })

    it('records error when reload fails', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockRejectedValue(new Error('Reload failed'))
      mockFindOptimalSellers.mockResolvedValue({})

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).reloadCardSellers('uuid-1')
      await flushPromises()

      expect(vm(wrapper).cardFetchErrors).toHaveLength(1)
      expect(vm(wrapper).cardFetchErrors[0].errorMessage).toBe('Reload failed')
    })

    it('closes browsing session after reload', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([])
      mockFindOptimalSellers.mockResolvedValue({})

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).reloadCardSellers('uuid-1')
      await flushPromises()

      expect(mockCloseBrowsingSession).toHaveBeenCalled()
    })

    it('persists results after reload', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).reloadCardSellers('uuid-1')
      await flushPromises()

      expect(StorageService.saveSearchResults).toHaveBeenCalled()
    })
  })

  describe('retrySearch', () => {
    it('clears error and re-fetches on success', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).cardFetchErrors = [
        {
          cardId: 'uuid-1',
          hadError: true,
          errorMessage: 'Previous error',
          sellersFound: false,
          fetchAttempted: true,
        },
      ]

      await vm(wrapper).retrySearch('uuid-1')
      await flushPromises()

      expect(vm(wrapper).cardFetchErrors).toHaveLength(0)
      expect(vm(wrapper).assignments['uuid-1']).toEqual(mockSeller1)
    })

    it('updates error on retry failure', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockRejectedValue(new Error('Still failing'))
      mockFindOptimalSellers.mockResolvedValue({})

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).cardFetchErrors = [
        {
          cardId: 'uuid-1',
          hadError: true,
          errorMessage: 'Old error',
          sellersFound: false,
          fetchAttempted: true,
        },
      ]

      await vm(wrapper).retrySearch('uuid-1')
      await flushPromises()

      expect(vm(wrapper).cardFetchErrors).toHaveLength(1)
      expect(vm(wrapper).cardFetchErrors[0].errorMessage).toBe('Still failing')
    })

    it('does nothing for unknown card ID', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).retrySearch('nonexistent')
      await flushPromises()

      expect(mockGetCardSellers).not.toHaveBeenCalled()
    })

    it('closes browsing session after retry', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([])
      mockFindOptimalSellers.mockResolvedValue({})

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).retrySearch('uuid-1')
      await flushPromises()

      expect(mockCloseBrowsingSession).toHaveBeenCalled()
    })
  })

  describe('removeAssignments', () => {
    it('clears assignments and errors', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).assignments = { 'uuid-1': mockSeller1 }
      vm(wrapper).cardFetchErrors = [
        {
          cardId: 'uuid-1',
          hadError: true,
          sellersFound: false,
          fetchAttempted: true,
        },
      ]

      await vm(wrapper).removeAssignments()
      await flushPromises()

      expect(Object.keys(vm(wrapper).assignments)).toHaveLength(0)
      expect(vm(wrapper).cardFetchErrors).toHaveLength(0)
      expect(vm(wrapper).searchAttempted).toBe(false)
    })

    it('removes persisted search results', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).removeAssignments()
      await flushPromises()

      expect(StorageService.removeSearchResults).toHaveBeenCalledWith(
        'test-deck.csv',
      )
    })

    it('auto-saves empty project state when project is loaded', async () => {
      mockProjectFileName.value = 'test.dcproject.json'
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).removeAssignments()
      await flushPromises()

      expect(ProjectService.autoSave).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        [],
        [],
        expect.anything(),
      )
    })
  })

  describe('saveFilters', () => {
    it('saves current filter values to storage', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).selectedLanguages = [1, 2]
      vm(wrapper).selectedMinCondition = 3
      vm(wrapper).selectedSellerCountries = [7, 12]

      await vm(wrapper).saveFilters()

      expect(StorageService.saveCardFilters).toHaveBeenCalledWith({
        language: [1, 2],
        minCondition: 3,
        sellerCountry: [7, 12],
      })
    })
  })

  describe('clearSavedFilters', () => {
    it('resets filters and saves empty values', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).selectedLanguages = [1]
      vm(wrapper).selectedMinCondition = 2
      vm(wrapper).selectedSellerCountries = [7]

      await vm(wrapper).clearSavedFilters()

      expect(vm(wrapper).selectedLanguages).toEqual([])
      expect(vm(wrapper).selectedMinCondition).toBeNull()
      expect(vm(wrapper).selectedSellerCountries).toEqual([])
      expect(StorageService.saveCardFilters).toHaveBeenCalledWith({
        language: [],
        minCondition: null,
        sellerCountry: [],
      })
    })
  })

  describe('saveProjectAs', () => {
    it('delegates to ProjectService.saveAs with current state', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).assignments = { 'uuid-1': mockSeller1 }
      vm(wrapper).selectedLanguages = [1]

      await vm(wrapper).saveProjectAs()
      await flushPromises()

      expect(ProjectService.saveAs).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ Id: 'uuid-1' })]),
        expect.objectContaining({ language: [1] }),
        expect.arrayContaining([
          expect.objectContaining({ cardName: 'Lightning Bolt' }),
        ]),
        expect.any(Array),
        expect.anything(),
      )
    })
  })

  describe('computed properties', () => {
    it('assignmentRows maps assignments to display rows', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).assignments = { 'uuid-1': mockSeller1 }
      await flushPromises()

      const rows = vm(wrapper).assignmentRows
      expect(rows).toHaveLength(1)
      expect(rows[0].cardName).toBe('Lightning Bolt')
      expect(rows[0].sellerName).toBe('ShopA')
      expect(rows[0].price).toBe(1.5)
    })

    it('totalPrice sums all assignment prices', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }, { ...mockCard2 }]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).assignments = {
        'uuid-1': mockSeller1,
        'uuid-2': mockSeller2,
      }
      await flushPromises()

      expect(vm(wrapper).totalPrice).toBe(3.5)
    })

    it('uniqueSellersCount counts distinct sellers', async () => {
      selectedCardsRef.value = [
        { ...mockCard1 },
        { ...mockCard2 },
        { ...mockCard3 },
      ]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).assignments = {
        'uuid-1': mockSeller1,
        'uuid-2': mockSeller1,
        'uuid-3': mockSeller2,
      }
      await flushPromises()

      expect(vm(wrapper).uniqueSellersCount).toBe(2)
    })

    it('failedCards maps errors to display objects', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).cardFetchErrors = [
        {
          cardId: 'uuid-1',
          hadError: true,
          errorMessage: 'Timeout',
          sellersFound: false,
          fetchAttempted: true,
        },
      ]
      await flushPromises()

      const failed = vm(wrapper).failedCards
      expect(failed).toHaveLength(1)
      expect(failed[0].cardName).toBe('Lightning Bolt')
      expect(failed[0].errorMessage).toBe('Timeout')
    })

    it('pendingCards returns cards without assignments or errors', async () => {
      selectedCardsRef.value = [
        { ...mockCard1 },
        { ...mockCard2 },
        { ...mockCard3 },
      ]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).assignments = { 'uuid-1': mockSeller1 }
      vm(wrapper).cardFetchErrors = [
        {
          cardId: 'uuid-2',
          hadError: true,
          sellersFound: false,
          fetchAttempted: true,
        },
      ]
      await flushPromises()

      const pending = vm(wrapper).pendingCards
      expect(pending).toHaveLength(1)
      expect(pending[0].cardName).toBe('Counterspell')
    })

    it('fetchPercentage computes progress correctly', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      // When total is 0
      expect(vm(wrapper).fetchPercentage).toBe(0)
    })

    it('hasAssignments is true when assignments exist', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      expect(vm(wrapper).hasAssignments).toBe(false)

      vm(wrapper).assignments = { 'uuid-1': mockSeller1 }
      await flushPromises()

      expect(vm(wrapper).hasAssignments).toBe(true)
    })
  })

  describe('navigation', () => {
    it('goBack navigates to /deck', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      const router = makeRouter()
      await router.push('/search')

      const wrapper = mountComponent(router)
      await flushPromises()

      vm(wrapper).goBack()
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/deck')
    })

    it('resetSelection clears cards and assignments', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).assignments = { 'uuid-1': mockSeller1 }
      vm(wrapper).searchAttempted = true

      vm(wrapper).resetSelection()

      expect(mockClearSelectedCards).toHaveBeenCalled()
      expect(Object.keys(vm(wrapper).assignments)).toHaveLength(0)
      expect(vm(wrapper).searchAttempted).toBe(false)
    })
  })

  describe('progress UI', () => {
    it('shows ProgressBar while searching', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]

      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.findComponent(ProgressBar).exists()).toBe(false)

      // Simulate searching state
      vm(wrapper).isSearching = true as never
      await flushPromises()

      expect(wrapper.find('.progress').exists()).toBe(true)
    })
  })

  describe('filters are passed to queries', () => {
    it('includes selected filters in card queries', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).selectedLanguages = [1, 3]
      vm(wrapper).selectedMinCondition = 2
      vm(wrapper).selectedSellerCountries = [7]

      await vm(wrapper).assignSellers()
      await flushPromises()

      const query = mockGetCardSellers.mock.calls[0][0]
      expect(query.Filters).toEqual({
        language: [1, 3],
        minCondition: 2,
        sellerCountry: [7],
      })
    })
  })

  describe('error handling edge cases', () => {
    it('clears assignments on top-level search error', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockRejectedValue(new Error('Algorithm crash'))

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(Object.keys(vm(wrapper).assignments)).toHaveLength(0)
      expect(vm(wrapper).isSearching).toBe(false)
    })

    it('handles non-Error throw in card fetch', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockRejectedValue('string error')
      mockFindOptimalSellers.mockResolvedValue({})

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(vm(wrapper).cardFetchErrors[0].errorMessage).toBe('string error')
    })
  })

  describe('persistResults edge cases', () => {
    it('warns and skips when no deck name available', async () => {
      mockGetStoredDeckFileName.mockReturnValue('')
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockGetCardSellers.mockResolvedValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).assignSellers()
      await flushPromises()

      expect(StorageService.saveSearchResults).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('parseCardNameFromUrl', () => {
    it('parses card name and edition from a valid Cardmarket URL', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      const result = vm(wrapper).parseCardNameFromUrl(
        'https://www.cardmarket.com/en/Magic/Products/Singles/dominaria-united/llanowar-elves',
      )
      expect(result.cardName).toBe('Llanowar Elves')
      expect(result.editionName).toBe('Dominaria United')
    })

    it('handles URL with query parameters', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      const result = vm(wrapper).parseCardNameFromUrl(
        'https://www.cardmarket.com/en/Magic/Products/Singles/alpha/lightning-bolt?language=1',
      )
      expect(result.cardName).toBe('Lightning Bolt')
      expect(result.editionName).toBe('Alpha')
    })

    it('returns empty strings when Singles segment is missing', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      const result = vm(wrapper).parseCardNameFromUrl(
        'https://www.cardmarket.com/en/Magic/Products/Search?searchString=bolt',
      )
      expect(result.cardName).toBe('')
      expect(result.editionName).toBe('')
    })

    it('returns empty strings for a malformed URL', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      const result = vm(wrapper).parseCardNameFromUrl('not-a-url')
      expect(result.cardName).toBe('')
      expect(result.editionName).toBe('')
    })
  })

  describe('openReplaceModal / closeReplaceModal', () => {
    it('openReplaceModal sets replaceTargetCardId and shows modal', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')

      expect(vm(wrapper).replaceTargetCardId).toBe('uuid-1')
      expect(vm(wrapper).replaceModalVisible).toBe(true)
    })

    it('closeReplaceModal hides modal and clears target card ID', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')
      vm(wrapper).closeReplaceModal()

      expect(vm(wrapper).replaceModalVisible).toBe(false)
      expect(vm(wrapper).replaceTargetCardId).toBeNull()
    })
  })

  describe('searchReplacementCard', () => {
    it('opens Cardmarket search URL for the target card', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')
      vm(wrapper).searchReplacementCard()

      expect(mockOpenURL).toHaveBeenCalledWith(
        expect.stringContaining('lightning%20bolt'),
      )
    })

    it('does nothing when no target card is set', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).searchReplacementCard()

      expect(mockOpenURL).not.toHaveBeenCalled()
    })
  })

  describe('handleReplace', () => {
    const cardmarketTab = {
      id: 42,
      url: 'https://www.cardmarket.com/en/Magic/Products/Singles/alpha/lightning-bolt',
      active: true,
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
    } as chrome.tabs.Tab

    it('does nothing when replaceTargetCardId is null', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      await vm(wrapper).handleReplace()
      await flushPromises()

      expect(mockTabsQuery).not.toHaveBeenCalled()
    })

    it('shows error modal when no Cardmarket tab is found', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockTabsQuery.mockImplementation(
        (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]),
      )

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')
      await vm(wrapper).handleReplace()
      await flushPromises()

      expect(vm(wrapper).replaceErrorModalVisible).toBe(true)
      expect(vm(wrapper).replaceError).toContain('No Cardmarket card page found')
      expect(vm(wrapper).replaceModalVisible).toBe(true)
    })

    it('shows error modal when the page has no sellers', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockTabsQuery.mockImplementation(
        (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([cardmarketTab]),
      )
      mockParseSellerListings.mockReturnValue([])

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')
      await vm(wrapper).handleReplace()
      await flushPromises()

      expect(vm(wrapper).replaceErrorModalVisible).toBe(true)
      expect(vm(wrapper).replaceError).toContain('no sellers')
      expect(vm(wrapper).replaceModalVisible).toBe(true)
    })

    it('updates card details and assignments on success', async () => {
      const card = { ...mockCard1 }
      selectedCardsRef.value = [card]
      mockTabsQuery.mockImplementation(
        (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([cardmarketTab]),
      )
      mockParseSellerListings.mockReturnValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')
      await vm(wrapper).handleReplace()
      await flushPromises()

      expect(card.CardName).toBe('Lightning Bolt')
      expect(card.EditionName).toBe('Alpha')
      expect(card.Link).toBe(cardmarketTab.url)
      expect(card.LastUpdated).toBeDefined()
      expect(vm(wrapper).assignments['uuid-1']).toEqual(mockSeller1)
    })

    it('removes the card from errors list when replace succeeds', async () => {
      const card = { ...mockCard1 }
      selectedCardsRef.value = [card]
      mockTabsQuery.mockImplementation(
        (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([cardmarketTab]),
      )
      mockParseSellerListings.mockReturnValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).cardFetchErrors = [
        {
          cardId: 'uuid-1',
          hadError: true,
          errorMessage: 'Old error',
          sellersFound: false,
          fetchAttempted: true,
        },
      ]

      vm(wrapper).openReplaceModal('uuid-1')
      await vm(wrapper).handleReplace()
      await flushPromises()

      expect(vm(wrapper).cardFetchErrors).toHaveLength(0)
    })

    it('closes replace modal after successful replace', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockTabsQuery.mockImplementation(
        (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([cardmarketTab]),
      )
      mockParseSellerListings.mockReturnValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')
      await vm(wrapper).handleReplace()
      await flushPromises()

      expect(vm(wrapper).replaceModalVisible).toBe(false)
      expect(vm(wrapper).replaceTargetCardId).toBeNull()
    })

    it('persists results after successful replace', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockTabsQuery.mockImplementation(
        (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([cardmarketTab]),
      )
      mockParseSellerListings.mockReturnValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')
      await vm(wrapper).handleReplace()
      await flushPromises()

      expect(StorageService.saveSearchResults).toHaveBeenCalled()
    })

    it('shows error modal when readTabHtml throws', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockTabsQuery.mockImplementation(
        (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([cardmarketTab]),
      )
      mockReadTabHtml.mockRejectedValue(new Error('Script injection failed'))

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')
      await vm(wrapper).handleReplace()
      await flushPromises()

      expect(vm(wrapper).replaceErrorModalVisible).toBe(true)
      expect(vm(wrapper).replaceError).toContain('Script injection failed')
    })

    it('prefers the active Cardmarket tab over inactive ones', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      const inactiveTab = { ...cardmarketTab, id: 10, active: false }
      const activeTab = {
        ...cardmarketTab,
        id: 99,
        active: true,
        url: 'https://www.cardmarket.com/en/Magic/Products/Singles/beta/dark-ritual',
      }
      mockTabsQuery.mockImplementation(
        (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
          cb([inactiveTab, activeTab]),
      )
      mockParseSellerListings.mockReturnValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')
      await vm(wrapper).handleReplace()
      await flushPromises()

      expect(mockReadTabHtml).toHaveBeenCalledWith(99)
    })

    it('clears isReplacing after completion', async () => {
      selectedCardsRef.value = [{ ...mockCard1 }]
      mockTabsQuery.mockImplementation(
        (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([cardmarketTab]),
      )
      mockParseSellerListings.mockReturnValue([mockSeller1])
      mockFindOptimalSellers.mockResolvedValue({ 'uuid-1': mockSeller1 })

      const wrapper = mountComponent()
      await flushPromises()

      vm(wrapper).openReplaceModal('uuid-1')
      const promise = vm(wrapper).handleReplace()
      await promise
      await flushPromises()

      expect(vm(wrapper).isReplacing).toBe(false)
    })
  })
})

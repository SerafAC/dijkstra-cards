<script setup lang="ts">
import { computed, onMounted, Ref, ref } from 'vue'
import { useRouter } from 'vue-router'
import { clearSelectedCards, useSelectedCards, getStoredDeckFileName } from '../stores/selectedCards'
import { FindOptimalSellers } from '../services/sellerAssignmentService'
import { GetCardSellers, closeBrowsingSession } from '../services/cardmarketService'
import { StorageService } from '../services/storageService'
import { CardService } from '../services/cardService'
import { Browser } from '../services/browser'
import { ProjectService } from '../services/projectService'
import { useProjectStore } from '../stores/projectStore'
import { sleep } from '../utils/async'
import { lastUpdatedColor, formatDate } from '../utils/dateUtils'
import type { Card, CardFilters, CardQuery, PersistedAssignment, PersistedError, Seller, SellerFetchStatus } from '../types/models'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ProgressBar from 'primevue/progressbar'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'

const router = useRouter()
const selectedCards = useSelectedCards()
const hasCards = computed(() => selectedCards.value.length > 0)
const assignments: Ref<Record<string, Seller>> = ref({})
const cardFetchErrors: Ref<SellerFetchStatus[]> = ref([])
const isSearching = ref(false)
const retryingCardId = ref<string | null>(null)
const searchAttempted = ref(false)
const fetchProgress = ref(0)
const fetchTotal = ref(0)
const currentCardName = ref('')
const sellersByCard = new Map<string, Seller[]>()

const languageOptions = [
  { label: 'English', value: 1 },
  { label: 'French', value: 2 },
  { label: 'German', value: 3 },
  { label: 'Spanish', value: 4 },
  { label: 'Italian', value: 5 },
  { label: 'S-Chinese', value: 6 },
  { label: 'Japanese', value: 7 },
  { label: 'Portuguese', value: 8 },
  { label: 'Russian', value: 9 },
  { label: 'Korean', value: 10 },
  { label: 'T-Chinese', value: 11 },
]

const conditionOptions = [
  { label: 'Mint', value: 1 },
  { label: 'Near Mint', value: 2 },
  { label: 'Excellent', value: 3 },
  { label: 'Good', value: 4 },
  { label: 'Light Played', value: 5 },
  { label: 'Played', value: 6 },
]

const sellerCountryOptions = [
  { label: '🇦🇹 Austria', value: 1 },
  { label: '🇧🇪 Belgium', value: 2 },
  { label: '🇧🇬 Bulgaria', value: 3 },
  { label: '🇨🇭 Switzerland', value: 4 },
  { label: '🇨🇾 Cyprus', value: 5 },
  { label: '🇨🇿 Czech Republic', value: 6 },
  { label: '🇩🇪 Germany', value: 7 },
  { label: '🇩🇰 Denmark', value: 8 },
  { label: '🇪🇪 Estonia', value: 9 },
  { label: '🇪🇸 Spain', value: 10 },
  { label: '🇫🇮 Finland', value: 11 },
  { label: '🇫🇷 France', value: 12 },
  { label: '🇬🇧 United Kingdom', value: 13 },
  { label: '🇬🇷 Greece', value: 14 },
  { label: '🇭🇺 Hungary', value: 15 },
  { label: '🇮🇪 Ireland', value: 16 },
  { label: '🇮🇹 Italy', value: 17 },
  { label: '🇱🇮 Liechtenstein', value: 18 },
  { label: '🇱🇹 Lithuania', value: 19 },
  { label: '🇱🇺 Luxembourg', value: 20 },
  { label: '🇱🇻 Latvia', value: 21 },
  { label: '🇲🇹 Malta', value: 22 },
  { label: '🇳🇱 Netherlands', value: 23 },
  { label: '🇳🇴 Norway', value: 24 },
  { label: '🇵🇱 Poland', value: 25 },
  { label: '🇵🇹 Portugal', value: 26 },
  { label: '🇷🇴 Romania', value: 27 },
  { label: '🇸🇪 Sweden', value: 28 },
  { label: '🇸🇬 Singapore', value: 29 },
  { label: '🇸🇮 Slovenia', value: 30 },
  { label: '🇸🇰 Slovakia', value: 31 },
  { label: '🇨🇦 Canada', value: 33 },
  { label: '🇭🇷 Croatia', value: 35 },
  { label: '🇯🇵 Japan', value: 36 },
  { label: '🇮🇸 Iceland', value: 37 },
]

const COUNTRY_ID_TO_FLAG: Record<number, string> = Object.fromEntries(
  sellerCountryOptions.map((c) => [c.value, c.label.split(' ')[0]]),
)

function getCountryFlag(countryId: number): string {
  return COUNTRY_ID_TO_FLAG[countryId] ?? ''
}

const { isProjectLoaded } = useProjectStore()

const selectedLanguages: Ref<number[]> = ref([])
const selectedMinCondition: Ref<number | null> = ref(null)
const selectedSellerCountries: Ref<number[]> = ref([])

onMounted(async () => {
  const saved = await StorageService.getCardFilters()
  if (saved) {
    selectedLanguages.value = saved.language ?? []
    selectedMinCondition.value = saved.minCondition ?? null
    selectedSellerCountries.value = saved.sellerCountry ?? []
  }

  await restorePersistedResults()
})

async function saveFilters() {
  const filters: CardFilters = {
    language: selectedLanguages.value,
    minCondition: selectedMinCondition.value,
    sellerCountry: selectedSellerCountries.value,
  }
  await StorageService.saveCardFilters(filters)
}

async function clearSavedFilters() {
  selectedLanguages.value = []
  selectedMinCondition.value = null
  selectedSellerCountries.value = []
  await StorageService.saveCardFilters({ language: [], minCondition: null, sellerCountry: [] })
}

function cardKey(card: { CardName: string; EditionName: string }): string {
  return `${card.CardName.toLowerCase()}|${card.EditionName.toLowerCase()}`
}

async function restorePersistedResults() {
  const deckName = CardService.GetDeckFileName() || getStoredDeckFileName()
  if (!deckName) return

  const saved = await StorageService.getSearchResults(deckName)
  if (!saved) return

  const cardsByKey = new Map<string, Card>()
  for (const card of selectedCards.value) {
    cardsByKey.set(cardKey(card), card)
  }

  const restored: Record<string, Seller> = {}
  for (const entry of saved.assignments) {
    const key = cardKey({ CardName: entry.cardName, EditionName: entry.editionName })
    const card = cardsByKey.get(key)
    if (card) {
      restored[card.Id] = entry.seller
      if (entry.lastUpdated) card.LastUpdated = entry.lastUpdated
    }
  }

  const restoredErrors: SellerFetchStatus[] = []
  for (const entry of saved.errors) {
    const key = cardKey({ CardName: entry.cardName, EditionName: entry.editionName })
    const card = cardsByKey.get(key)
    if (card) {
      restoredErrors.push({
        cardId: card.Id,
        hadError: true,
        errorMessage: entry.errorMessage,
        sellersFound: false,
        fetchAttempted: true,
      })
    }
  }

  if (saved.sellersByCard?.length) {
    for (const entry of saved.sellersByCard) {
      const key = cardKey({ CardName: entry.cardName, EditionName: entry.editionName })
      const card = cardsByKey.get(key)
      if (card) {
        sellersByCard.set(card.Id, entry.sellers)
      }
    }
  }

  if (Object.keys(restored).length > 0 || restoredErrors.length > 0) {
    assignments.value = restored
    cardFetchErrors.value = restoredErrors
    searchAttempted.value = true
  }
}

async function persistResults() {
  const deckName = CardService.GetDeckFileName()
  if (!deckName) return

  const { assignments: persistedAssignments, errors: persistedErrors } = await buildPersistedData()

  await StorageService.saveSearchResults({
    deckFileName: deckName,
    assignments: persistedAssignments,
    errors: persistedErrors,
  })

  await autoSaveProject(persistedAssignments, persistedErrors)
}

async function buildPersistedData(): Promise<{
  assignments: PersistedAssignment[]
  errors: PersistedError[]
}> {
  const persistedAssignments: PersistedAssignment[] = []
  for (const [cardId, seller] of Object.entries(assignments.value)) {
    const card = selectedCards.value.find((c) => c.Id === cardId)
    if (card) {
      persistedAssignments.push({
        cardName: card.CardName,
        editionName: card.EditionName,
        seller,
        lastUpdated: card.LastUpdated,
      })
    }
  }

  const persistedErrors: PersistedError[] = cardFetchErrors.value.map((status) => {
    const card = selectedCards.value.find((c) => c.Id === status.cardId)
    return {
      cardName: card?.CardName || '',
      editionName: card?.EditionName || '',
      errorMessage: status.errorMessage ?? '',
    }
  })

  return { assignments: persistedAssignments, errors: persistedErrors }
}

async function autoSaveProject(
  persistedAssignments: PersistedAssignment[],
  persistedErrors: PersistedError[],
) {
  if (!isProjectLoaded.value) return

  const filters: CardFilters = {
    language: selectedLanguages.value,
    minCondition: selectedMinCondition.value,
    sellerCountry: selectedSellerCountries.value,
  }

  await ProjectService.autoSave(
    selectedCards.value,
    filters,
    persistedAssignments,
    persistedErrors,
    sellersByCard,
  )
}

async function saveProjectAs() {
  const { assignments: pa, errors: pe } = await buildPersistedData()
  const filters: CardFilters = {
    language: selectedLanguages.value,
    minCondition: selectedMinCondition.value,
    sellerCountry: selectedSellerCountries.value,
  }
  await ProjectService.saveAs(selectedCards.value, filters, pa, pe, sellersByCard)
}

async function removeAssignments() {
  const deckName = CardService.GetDeckFileName()
  if (deckName) {
    await StorageService.removeSearchResults(deckName)
  }
  assignments.value = {}
  cardFetchErrors.value = []
  searchAttempted.value = false
  await autoSaveProject([], [])
}


const assignmentRows = computed(() =>
  Object.entries(assignments.value).map((entry) => {
    const card = selectedCards.value.find((card) => card.Id === entry[0])
    return {
      cardName: card?.CardName || 'Unknown card',
      setName: card?.EditionName || 'Unknown edition',
      sellerName: entry[1]?.SellerName ?? 'No seller found',
      sellerCountryFlag: getCountryFlag(entry[1]?.SellerCountryId ?? 0),
      sellerCountry: entry[1]?.SellerCountry ?? '',
      price: entry[1]?.Price ?? 0,
      link: card?.Link || '',
      lastUpdated: card?.LastUpdated,
    }
  }),
)

const hasAssignments = computed(() => assignmentRows.value.length > 0)
const totalPrice = computed(() => assignmentRows.value.reduce((sum, row) => sum + row.price, 0))
const fetchPercentage = computed(() =>
  fetchTotal.value > 0 ? Math.round((fetchProgress.value / fetchTotal.value) * 100) : 0,
)

const failedCards = computed(() =>
  cardFetchErrors.value.map((status) => {
    const sellersFound = status?.sellersFound ?? false
    const errorMessage = status?.errorMessage ?? ''
    const card = selectedCards.value.find((card) => card.Id == status.cardId)

    return {
      id: card?.Id,
      cardName: card?.CardName || 'Unknown card',
      setName: card?.EditionName || 'Unknown edition',
      link: card?.Link || '',
      sellersFound,
      errorMessage,
    }
  }),
)

const hasFailedCards = computed(() => failedCards.value.length > 0)
const failedSectionCollapsed = ref(true)

function searchCardByNameUrl(cardName: string) {
  const uriCardName = encodeURIComponent(cardName.toLowerCase())
  return `https://www.cardmarket.com/en/Magic/Products/Search?category=-1&searchString=${uriCardName}&searchMode=v2`
}

function cardLinkWithFilters(baseUrl: string): string {
  if (!baseUrl) return baseUrl
  const url = new URL(baseUrl)
  if (selectedLanguages.value.length > 0) {
    url.searchParams.set('language', selectedLanguages.value.join(','))
  }
  if (selectedMinCondition.value) {
    url.searchParams.set('minCondition', selectedMinCondition.value.toString())
  }
  if (selectedSellerCountries.value.length > 0) {
    for (const countryId of selectedSellerCountries.value) {
      url.searchParams.append(`sellerCountry[${countryId}]`, countryId.toString())
    }
  }
  return url.toString()
}

function goBack() {
  router.push('/deck')
}

function resetSelection() {
  clearSelectedCards()
  assignments.value = {}
  searchAttempted.value = false
}

function buildQueryFromRow(row: Card): CardQuery {
  const filters: CardFilters = {
    language: selectedLanguages.value,
    minCondition: selectedMinCondition.value,
    sellerCountry: selectedSellerCountries.value,
  }
  return {
    Card: row,
    Language: 'en',
    ShipmentDestination: '',
    Filters: filters,
  }
}

async function assignSellers() {
  searchAttempted.value = true

  if (!hasCards.value) {
    assignments.value = {}
    return
  }

  const assignedCardIds = new Set(Object.keys(assignments.value))

  const queries = selectedCards.value
    .filter((card) => !assignedCardIds.has(card.Id))
    .map(buildQueryFromRow)
    .filter((card) => card.Card.CardName.length > 0)

  if (!queries.length && assignedCardIds.size > 0) {
    return
  }

  if (!queries.length) {
    assignments.value = {}
    return
  }

  try {
    isSearching.value = true
    fetchProgress.value = 0
    fetchTotal.value = queries.length

    const fetchedIds = new Set<string>()
    const newErrors: SellerFetchStatus[] = []

    for (const query of queries) {
      currentCardName.value = query.Card.CardName
      fetchedIds.add(query.Card.Id)

      try {
        const sellers = await GetCardSellers(query)
        sellersByCard.set(query.Card.Id, sellers)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        newErrors.push({ cardId: query.Card.Id, hadError: true, errorMessage: msg, sellersFound: false, fetchAttempted: true })
        console.error('Failed fetching sellers for card', query, err)
      } finally {
        fetchProgress.value += 1
      }

      await sleep(1000)
    }

    const newAssignments = await FindOptimalSellers(selectedCards.value, sellersByCard)
    assignments.value = { ...assignments.value, ...newAssignments }

    const now = new Date().toISOString()
    for (const cardId of Object.keys(newAssignments)) {
      const card = selectedCards.value.find((c) => c.Id === cardId)
      if (card) card.LastUpdated = now
    }

    const keptErrors = cardFetchErrors.value.filter((e) => !fetchedIds.has(e.cardId))
    cardFetchErrors.value = [...keptErrors, ...newErrors]

    await persistResults()
  } catch (err) {
    console.log('>>> error: ', err)
    assignments.value = {}
  } finally {
    closeBrowsingSession()
    isSearching.value = false
    currentCardName.value = ''
  }
}

async function retrySearch(cardId: string) {
  const card = selectedCards.value.find((c) => c.Id === cardId)
  if (!card) return

  retryingCardId.value = cardId
  sellersByCard.delete(cardId)

  try {
    const sellers = await GetCardSellers(buildQueryFromRow(card))
    sellersByCard.set(cardId, sellers)
    cardFetchErrors.value = cardFetchErrors.value.filter((e) => e.cardId !== cardId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    cardFetchErrors.value = [
      ...cardFetchErrors.value.filter((e) => e.cardId !== cardId),
      { cardId, hadError: true, errorMessage: msg, sellersFound: false, fetchAttempted: true },
    ]
    console.error('Retry search failed for card', card.CardName, err)
  } finally {
    closeBrowsingSession()
  }

  // Recalculate optimal sellers across all cards
  const newAssignments = await FindOptimalSellers(selectedCards.value, sellersByCard)
  assignments.value = newAssignments

  const now = new Date().toISOString()
  const retried = selectedCards.value.find((c) => c.Id === cardId)
  if (retried && newAssignments[cardId]) retried.LastUpdated = now

  await persistResults()
  retryingCardId.value = null
}
</script>

<template>
  <div class="search-page">
    <div class="header">
      <h2>Search Cards</h2>
      <div class="actions">
        <Button
          label="Back to Deck"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          @click="goBack"
        />
        <Button
          label="Reset selection"
          icon="pi pi-refresh"
          severity="danger"
          outlined
          @click="resetSelection"
        />
      </div>
    </div>

    <div v-if="hasCards" class="results">
      <div class="filters">
        <div class="filter-group">
          <label>Language</label>
          <MultiSelect
            v-model="selectedLanguages"
            :options="languageOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Any language"
            :maxSelectedLabels="3"
          />
        </div>
        <div class="filter-group">
          <label>Min Condition</label>
          <Select
            v-model="selectedMinCondition"
            :options="conditionOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Any condition"
            showClear
          />
        </div>
        <div class="filter-group">
          <label>Seller Country</label>
          <MultiSelect
            v-model="selectedSellerCountries"
            :options="sellerCountryOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Any country"
            :maxSelectedLabels="2"
            filter
          />
        </div>
        <div class="filter-actions">
          <Button
            icon="pi pi-save"
            size="small"
            severity="secondary"
            outlined
            v-tooltip="'Save filters as default'"
            @click="saveFilters"
          />
          <Button
            icon="pi pi-eraser"
            size="small"
            severity="danger"
            outlined
            v-tooltip="'Clear saved filters'"
            @click="clearSavedFilters"
          />
        </div>
      </div>

      <div class="search-actions">
        <Button
          label="Assign sellers"
          icon="pi pi-search"
          :disabled="!hasCards || isSearching"
          :loading="isSearching"
          @click="assignSellers"
        />
        <Button
          v-if="hasAssignments"
          label="Remove assignments"
          icon="pi pi-trash"
          severity="danger"
          outlined
          :disabled="isSearching"
          @click="removeAssignments"
        />
        <div class="search-actions__spacer" />
        <Button
          label="Save Project"
          icon="pi pi-save"
          severity="secondary"
          outlined
          :disabled="isSearching"
          @click="saveProjectAs"
        />
      </div>

      <div v-if="isSearching" class="progress">
        <div class="progress-header">
          <span>Fetching sellers...</span>
          <small v-if="currentCardName">{{ currentCardName }}</small>
          <small v-else>{{ fetchProgress }} / {{ fetchTotal }} cards</small>
        </div>
        <ProgressBar :value="fetchPercentage" />
        <div class="progress-summary">
          <span>{{ fetchProgress }} / {{ fetchTotal }} cards</span>
        </div>
      </div>

      <div v-if="hasFailedCards" class="failed-section">
        <div class="failed-section__header">
          <div class="failed-section__title">
            <i class="pi pi-exclamation-triangle"></i>
            <span>Failed cards</span>
            <span class="failed-section__count">
              {{ failedCards.length }} {{ failedCards.length === 1 ? 'card' : 'cards' }}
            </span>
          </div>
          <div class="failed-section__actions">
            <Button
              size="small"
              severity="secondary"
              text
              :icon="failedSectionCollapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
              :label="failedSectionCollapsed ? 'Show details' : 'Hide details'"
              @click="failedSectionCollapsed = !failedSectionCollapsed"
            />
          </div>
        </div>
        <p class="failed-section__summary">
          {{
            failedCards.length === 1
              ? 'This card could not fetch sellers.'
              : 'These cards could not fetch sellers.'
          }}
        </p>

        <div v-if="hasFailedCards && !failedSectionCollapsed" class="failed-table">
          <DataTable size="small" :value="failedCards">
            <Column field="cardName" header="Card name" />
            <Column field="setName" header="Edition" />
            <Column header="Error">
              <template #body="slotProps">
                <span
                  class="status-chip"
                  :class="{ 'is-error': slotProps.data.hadError }"
                  :title="slotProps.data.errorMessage"
                >
                  {{ slotProps.data.errorMessage }}
                </span>
              </template>
            </Column>
            <Column header="Actions">
              <template #body="slotProps">
                <div class="failed-actions">
                  <Button
                    icon="pi pi-external-link"
                    aria-label="Market Link"
                    size="small"
                    severity="secondary"
                    :disabled="!slotProps.data.link"
                    v-tooltip="slotProps.data.link"
                    @click="Browser.OpenURL(cardLinkWithFilters(slotProps.data.link))"
                  />
                  <Button
                    icon="pi pi-search"
                    aria-label="Market Search Link"
                    size="small"
                    severity="secondary"
                    :disabled="!slotProps.data.link"
                    v-tooltip="'Search market by a card name'"
                    @click="Browser.OpenURL(searchCardByNameUrl(slotProps.data.cardName))"
                  />
                  <Button
                    label="Retry search"
                    icon="pi pi-refresh"
                    size="small"
                    severity="warn"
                    outlined
                    :disabled="isSearching || retryingCardId !== null"
                    :loading="retryingCardId === slotProps.data.id"
                    @click="retrySearch(slotProps.data.id)"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <div v-if="hasAssignments" class="summary-card">
        <h3>Cards number: {{ selectedCards.length - failedCards.length }}</h3>
        <h3>Total price: {{ totalPrice.toFixed(2) }}</h3>
      </div>

      <h3>Assignments</h3>
      <div class="results-table">
        <DataTable v-if="hasAssignments" size="small" :value="assignmentRows">
          <Column field="cardName" header="Card name" />
          <Column field="setName" header="Edition" />
          <Column field="sellerName" header="Selected seller">
            <template #body="slotProps">
              <span>
                <span
                  v-if="slotProps.data.sellerCountryFlag"
                  :title="slotProps.data.sellerCountry"
                  class="seller-flag"
                >{{ slotProps.data.sellerCountryFlag }}</span>{{ slotProps.data.sellerName }}
              </span>
            </template>
          </Column>
          <Column field="price" header="Price" />
          <Column field="lastUpdated" header="Last Updated">
            <template #body="slotProps">
              <span
                v-if="slotProps.data.lastUpdated"
                :style="{ color: lastUpdatedColor(slotProps.data.lastUpdated) }"
              >
                {{ formatDate(slotProps.data.lastUpdated) }}
              </span>
              <span v-else>-</span>
            </template>
          </Column>
          <Column field="link" header="Actions">
            <template #body="slotProps">
              <Button
                icon="pi pi-external-link"
                aria-label="Market Link"
                v-tooltip="slotProps.data.link"
                severity="secondary"
                @click="Browser.OpenURL(cardLinkWithFilters(slotProps.data.link))"
              />
            </template>
          </Column>
        </DataTable>
        <div v-else class="results-placeholder">
          <p v-if="searchAttempted && !isSearching">
            No seller assignments available for the selected cards.
          </p>
          <p v-else>Select cards from the deck and click "Assign sellers" to see the results.</p>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <i class="pi pi-info-circle"></i>
      <p>No cards selected. Please go back and choose cards from the deck table.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.search-page {
  @include mixins.dc-container;
  min-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 2rem 2rem;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .actions {
    display: flex;
    gap: 0.5rem;
  }
}

.results {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);

  .summary-card {
    width: 100%;
    border-radius: 8px;
    border: 2px solid var(--p-button-outlined-secondary-border-color);
    padding: 10px;
    display: flex;
    justify-content: space-around;
  }
}

.filters {
  display: flex;
  gap: 1rem;
  align-items: flex-end;

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-color-secondary);
    }
  }

  .filter-actions {
    display: flex;
    gap: 0.25rem;
  }
}

.search-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;

  &__spacer {
    flex: 1;
  }
}

.results-table {
  min-height: 160px;
}

.failed-section {
  border: 1px solid var(--p-button-outlined-danger-border-color);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 20px;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;

    i {
      color: var(--yellow-500);
    }
  }

  &__count {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    & > span {
      font-size: 0.85rem;
      color: var(--text-color-secondary);
    }
  }

  &__summary {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-color-secondary);
  }
}

.failed-table {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.failed-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.status-chip {
  display: block;
  max-width: 250px;
  max-height: 55px;
  overflow: hidden;
  word-break: break-all;
  text-overflow: ellipsis;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  border-radius: 8px;
  font-size: 0.85rem;
  background: color-mix(in srgb, var(--p-red-500) 20%, transparent);
  color: var(--text-color-secondary);
}

.seller-flag {
  margin-right: 0.3rem;
}

.results-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: var(--text-color-secondary);
  border: 1px dashed var(--surface-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-card) 90%, transparent);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  border: 1px dashed var(--surface-border);
  border-radius: 8px;
  color: var(--text-color-secondary);
}
</style>

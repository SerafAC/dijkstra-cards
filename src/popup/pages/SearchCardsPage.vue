<script setup lang="ts">
import { computed, Ref, ref } from 'vue'
import { useRouter } from 'vue-router'
import { clearSelectedCards, useSelectedCards } from '../stores/selectedCards'
import { FindOptimalSellers } from '../mocks/sellerAssignmentService'
import { GetCardSellers, GetFetchStatuses, closeBrowsingSession } from '../mocks/cardmarketService'
import { Browser } from '../mocks/browser'
import type { Card, CardQuery, Seller, SellerFetchStatus } from '../types/models'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ProgressBar from 'primevue/progressbar'

const router = useRouter()
const selectedCards = useSelectedCards()
const hasCards = computed(() => selectedCards.value.length > 0)
const assignments: Ref<Record<string, Seller>> = ref({})
const cardFetchErrors: Ref<SellerFetchStatus[]> = ref([])
const isSearching = ref(false)
const searchAttempted = ref(false)
const fetchProgress = ref(0)
const currentCardName = ref('')

const assignmentRows = computed(() =>
  Object.entries(assignments.value).map((entry) => {
    const card = selectedCards.value.find((card) => card.Id === entry[0])
    return {
      cardName: card?.CardName || 'Unknown card',
      setName: card?.EditionName || 'Unknown edition',
      sellerName: entry[1]?.SellerName ?? 'No seller found',
      price: entry[1]?.Price ?? 0,
      link: card?.Link || '',
    }
  }),
)

const hasAssignments = computed(() => assignmentRows.value.length > 0)
const totalPrice = computed(() => assignmentRows.value.reduce((sum, row) => sum + row.price, 0))
const fetchPercentage = computed(() =>
  hasCards.value ? Math.round((fetchProgress.value / selectedCards.value.length) * 100) : 0,
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

function goBack() {
  router.push('/deck')
}

function resetSelection() {
  clearSelectedCards()
  assignments.value = {}
  searchAttempted.value = false
}

function buildQueryFromRow(row: Card): CardQuery {
  return {
    Card: row,
    Language: 'en',
    ShipmentDestination: '',
  }
}

async function assignSellers() {
  searchAttempted.value = true

  if (!hasCards.value) {
    assignments.value = {}
    return
  }

  const queries = selectedCards.value
    .map(buildQueryFromRow)
    .filter((card) => card.Card.CardName.length > 0)

  if (!queries.length) {
    assignments.value = {}
    return
  }

  try {
    isSearching.value = true
    fetchProgress.value = 0

    for (const query of queries) {
      currentCardName.value = query.Card.CardName

      try {
        await GetCardSellers(query)
      } catch (err) {
        console.error('Failed fetching sellers for card', query, err)
      } finally {
        fetchProgress.value += 1
      }
    }

    assignments.value = await FindOptimalSellers(selectedCards.value)

    cardFetchErrors.value = (
      await GetFetchStatuses(selectedCards.value.map((card) => card.Id))
    ).filter((status) => status.hadError)
  } catch (err) {
    console.log('>>> error: ', err)
    assignments.value = {}
  } finally {
    closeBrowsingSession()
    isSearching.value = false
    currentCardName.value = ''
  }
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
      <div>
        <!-- TODO: Query filters should be here -->
      </div>

      <Button
        label="Assign sellers"
        icon="pi pi-search"
        :disabled="!hasCards || isSearching"
        :loading="isSearching"
        @click="assignSellers"
      />

      <div v-if="isSearching" class="progress">
        <div class="progress-header">
          <span>Fetching sellers...</span>
          <small v-if="currentCardName">{{ currentCardName }}</small>
          <small v-else>{{ fetchProgress }} / {{ selectedCards.length }} cards</small>
        </div>
        <ProgressBar :value="fetchPercentage" />
        <div class="progress-summary">
          <span>{{ fetchProgress }} / {{ selectedCards.length }} cards</span>
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
            <Column header="Link">
              <template #body="slotProps">
                <Button
                  icon="pi pi-external-link"
                  aria-label="Market Link"
                  size="small"
                  severity="secondary"
                  :disabled="!slotProps.data.link"
                  v-tooltip="slotProps.data.link"
                  @click="Browser.OpenURL(slotProps.data.link)"
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
          <Column field="sellerName" header="Selected seller" />
          <Column field="price" header="Price" />
          <Column field="link" header="Market Link">
            <template #body="slotProps">
              <Button
                icon="pi pi-external-link"
                aria-label="Market Link"
                v-tooltip="slotProps.data.link"
                severity="secondary"
                @click="Browser.OpenURL(slotProps.data.link)"
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
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 100vh;
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

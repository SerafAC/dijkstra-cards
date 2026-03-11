<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { CardService } from '../services/cardService'
import { saveSelectedCards, useSelectedCards, getStoredDeckFileName } from '../stores/selectedCards'
import { Browser } from '../services/browser'
import { lastUpdatedColor, formatDate } from '../utils/dateUtils'
import type { Card } from '../types/models'
import Message from 'primevue/message'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const errorMsg = ref<string | null>(null)
const cards = ref<Card[]>([])
const selectedCards = ref<Card[]>([])
const router = useRouter()
let navigatingToSearch = false

function handleNext() {
  if (!selectedCards.value.length) return

  saveSelectedCards(selectedCards.value, CardService.GetDeckFileName())
  navigatingToSearch = true
  router.push('/search')
}


onMounted(async () => {
  cards.value = await CardService.GetCards()

  const storedCards = useSelectedCards()
  if (storedCards.value.length) {
    const storedById = new Map(storedCards.value.map((c) => [c.Id, c]))
    for (const card of cards.value) {
      const stored = storedById.get(card.Id)
      if (stored?.LastUpdated) card.LastUpdated = stored.LastUpdated
    }
    selectedCards.value = cards.value.filter((c) => storedById.has(c.Id))
  }
})

onBeforeUnmount(() => {
  if (!navigatingToSearch) {
    saveSelectedCards(selectedCards.value, CardService.GetDeckFileName() || getStoredDeckFileName())
  }
})
</script>

<template>
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h2 style="margin-left: 12px">Deck Viewer</h2>
        <RouterLink to="/">
          <Button label="Back to Start" icon="pi pi-arrow-left" severity="secondary" outlined />
        </RouterLink>
      </div>
      <Button
        class="btn-next"
        label="Next"
        icon="pi pi-arrow-right"
        :disabled="!selectedCards.length"
        @click="handleNext"
      />
    </div>

    <Message v-if="errorMsg" severity="error" :closable="true" @close="errorMsg = null">
      {{ errorMsg }}
    </Message>

    <div class="card" v-if="cards.length">
      <DataTable
        class="table"
        :value="cards"
        size="small"
        scrollable
        scrollHeight="flex"
        v-model:selection="selectedCards"
        selectionMode="multiple"
        sortField="CardName"
        :sortOrder="1"
      >
        <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
        <Column field="Quantity" header="Quantity" sortable />
        <Column field="CardName" header="Card Name" sortable />
        <Column field="EditionName" header="Edition Name" sortable />
        <Column field="LastUpdated" header="Last Updated" sortable>
          <template #body="slotProps">
            <span
              v-if="slotProps.data.LastUpdated"
              :style="{ color: lastUpdatedColor(slotProps.data.LastUpdated) }"
            >
              {{ formatDate(slotProps.data.LastUpdated) }}
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </Column>
        <Column field="Link" header="Market Link">
          <template #body="slotProps">
            <Button
              icon="pi pi-external-link"
              severity="secondary"
              size="small"
              aria-label="Market Link"
              v-tooltip="slotProps.data.Link"
              @click="Browser.OpenURL(slotProps.data.Link)"
            />
          </template>
        </Column>
      </DataTable>


    </div>
  </div>
</template>

<style scoped lang="scss">
.page {
  @include mixins.dc-container;
  min-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 0 150px;
  box-sizing: border-box;

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .header-left {
      display: flex;
      align-items: center;
    }

    h2 {
      margin-right: 16px;
    }
    .btn-next {
      margin-right: 20px;
    }
  }
}



.card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: stretch;
  justify-content: flex-start;
  margin: 0 50px;
  flex: 1;
  min-height: 0;

  .table {
    width: 100%;
    height: 100%;
  }
}

</style>

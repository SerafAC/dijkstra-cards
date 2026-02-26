<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CardService } from '../../bindings/dijkstra-cards/src/cards'
import { saveSelectedCards } from '../stores/selectedCards'
import { Card } from '../../bindings/dijkstra-cards/src/models'
import { Browser } from '@wailsio/runtime'

const errorMsg = ref<string | null>(null)
const cards = ref<Card[]>([])
const selectedCards = ref<Card[]>([])
const router = useRouter()

function handleNext() {
  if (!selectedCards.value.length) return

  saveSelectedCards(selectedCards.value)
  router.push('/search')
}

onMounted(async () => {
  cards.value = await CardService.GetCards()
})
</script>

<template>
  <div class="page">
    <div class="header">
      <h2 style="margin-left: 12px">Deck Viewer</h2>
      <RouterLink to="/">
        <Button label="Back to Start" icon="pi pi-arrow-left" severity="secondary" outlined />
      </RouterLink>
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
      >
        <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
        <Column field="Quantity" header="Quantity" />
        <Column field="CardName" header="Card Name" />
        <Column field="EditionName" header="Edition Name" />
        <Column field="Link" header="Market Link">
          <template #body="slotProps">
            <Button
              icon="pi pi-external-link"
              severity="secondary"
              size="small"
              aria-label="Market Link"
              v-tooltip="slotProps.data.Link"
              @click="Browser.OpenURL(slotProps.data.Link)"/>
          </template>
        </Column>
      </DataTable>

      <div class="actions">
        <Button
          label="Next"
          icon="pi pi-arrow-right"
          :disabled="!selectedCards.length"
          @click="handleNext"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100vh;
  padding: 1rem 0 150px;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;

  h2 {
    margin-right: 16px;
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

.actions {
  width: 100%;
  display: flex;
  justify-content: flex-end;
}
</style>

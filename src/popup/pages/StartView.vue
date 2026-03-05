<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CardService } from '../services/cardService'
import { StorageService } from '../services/storageService'
import type { RecentDeck } from '../types/models'
import Image from 'primevue/image'
import Message from 'primevue/message'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const recentDecks = ref<RecentDeck[]>([])

onMounted(async () => {
  recentDecks.value = await StorageService.getRecentDecks()
})

async function onOpenDeck() {
  loading.value = true
  try {
    const result = await CardService.LoadCards()
    loading.value = false
    if (result) {
      recentDecks.value = await StorageService.getRecentDecks()
      router.push({ path: '/deck' })
    }
  } catch (er) {
    error.value = er as string
    loading.value = false
  }
}

async function onOpenRecent(deck: RecentDeck) {
  loading.value = true
  try {
    const result = await CardService.LoadFromRecent(deck.csvContent, deck.fileName)
    loading.value = false
    if (result) {
      router.push({ path: '/deck' })
    } else {
      error.value = `Failed to load "${deck.fileName}".`
    }
  } catch (er) {
    error.value = er as string
    loading.value = false
  }
}

async function onRemoveRecent(deck: RecentDeck) {
  await StorageService.removeRecentDeck(deck.fileName)
  recentDecks.value = await StorageService.getRecentDecks()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="page">
    <div class="header">
      <img class="banner" src="/baner.png" />
    </div>
    <div class="content">
      <Message v-if="error" severity="error" :closable="true" @close="error = ''">
        {{ error }}
      </Message>

      <div v-if="!loading" class="card actions">
        <Button label="Open Deck Export" icon="pi pi-upload" @click="onOpenDeck" :loading="loading" />
      </div>

      <div class="status" v-if="loading">
        <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
        <span style="margin-left: 8px">Loading CSV...</span>
      </div>

      <div v-if="!loading && recentDecks.length" class="recent-decks">
        <h3 class="recent-title">Recent Decks</h3>
        <DataTable :value="recentDecks" size="small" scrollable scrollHeight="flex">
          <Column field="fileName" header="File" />
          <Column field="cardCount" header="Cards" style="width: 5rem; text-align: center" />
          <Column header="Opened" style="width: 8rem">
            <template #body="{ data }">{{ formatDate(data.loadedAt) }}</template>
          </Column>
          <Column header="" style="width: 8rem">
            <template #body="{ data }">
              <div class="row-actions">
                <Button
                  icon="pi pi-folder-open"
                  size="small"
                  severity="secondary"
                  text
                  @click="onOpenRecent(data)"
                  v-tooltip="'Open deck'"
                />
                <Button
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  text
                  @click="onRemoveRecent(data)"
                  v-tooltip="'Remove from list'"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page {
  @include mixins.dc-container;
  min-height: 90vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 20px;

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    width: 100%;
    max-width: 700px;
    flex-grow: 1;
  }
}

.banner {
  margin: 20px 0;
  height: 187px;
}

.actions {
  display: flex;
  justify-content: center;
}

.recent-decks {
  width: calc(100% - 40px);

  .recent-title {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--p-surface-700);

    .app-dark & {
      color: var(--p-surface-300);
    }
  }
}

.row-actions {
  display: flex;
  gap: 0.25rem;
}
</style>

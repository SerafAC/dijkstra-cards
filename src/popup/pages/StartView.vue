<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CardService } from '../services/cardService'
import { StorageService } from '../services/storageService'
import { ProjectService } from '../services/projectService'
import { useProjectStore } from '../stores/projectStore'
import type { RecentDeck, RecentProject } from '../types/models'
import Message from 'primevue/message'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

type RecentItem =
  | ({ kind: 'deck' } & RecentDeck)
  | ({ kind: 'project' } & RecentProject)

const router = useRouter()
const loading = ref(false)
const error = ref('')
const recentDecks = ref<RecentDeck[]>([])
const recentProjects = ref<RecentProject[]>([])
const { isProjectLoaded, currentProjectName } = useProjectStore()

const recentItems = computed<RecentItem[]>(() => {
  const decks: RecentItem[] = recentDecks.value.map((d) => ({ kind: 'deck', ...d }))
  const projects: RecentItem[] = recentProjects.value.map((p) => ({ kind: 'project', ...p }))
  return [...decks, ...projects].sort(
    (a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime(),
  )
})

onMounted(async () => {
  ;[recentDecks.value, recentProjects.value] = await Promise.all([
    StorageService.getRecentDecks(),
    StorageService.getRecentProjects(),
  ])
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

async function onOpenProject() {
  loading.value = true
  try {
    const result = await ProjectService.open()
    loading.value = false
    if (result) {
      recentProjects.value = await StorageService.getRecentProjects()
      router.push({ path: '/deck' })
    }
  } catch (er) {
    error.value = er as string
    loading.value = false
  }
}

async function onOpenRecentProject(project: RecentProject) {
  loading.value = true
  try {
    const projectFile = JSON.parse(project.projectContent)
    const result = await ProjectService.restoreProject(projectFile)
    loading.value = false
    if (result) {
      router.push({ path: '/deck' })
    } else {
      error.value = `Failed to load "${project.fileName}".`
    }
  } catch (er) {
    error.value = er as string
    loading.value = false
  }
}

async function onRemoveRecentProject(project: RecentProject) {
  await StorageService.removeRecentProject(project.fileName)
  recentProjects.value = await StorageService.getRecentProjects()
}

async function onOpenItem(item: RecentItem) {
  if (item.kind === 'deck') {
    await onOpenRecent(item)
  } else {
    await onOpenRecentProject(item)
  }
}

async function onRemoveItem(item: RecentItem) {
  if (item.kind === 'deck') {
    await onRemoveRecent(item)
  } else {
    await onRemoveRecentProject(item)
  }
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
        <Button label="Open Project" icon="pi pi-folder-open" severity="secondary" @click="onOpenProject" :loading="loading" />
      </div>

      <div class="status" v-if="loading">
        <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
        <span style="margin-left: 8px">Loading...</span>
      </div>

      <div v-if="!loading && recentItems.length" class="recent-decks">
        <h3 class="recent-title">Recent</h3>
        <DataTable :value="recentItems" size="small" scrollable scrollHeight="flex">
          <Column header="" style="width: 2rem; padding-right: 0">
            <template #body="{ data }">
              <i
                :class="data.kind === 'project' ? 'pi pi-file' : 'pi pi-table'"
                v-tooltip="data.kind === 'project' ? 'Project' : 'Deck'"
                class="type-icon"
              />
            </template>
          </Column>
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
                  @click="onOpenItem(data)"
                  v-tooltip="data.kind === 'project' ? 'Open project' : 'Open deck'"
                />
                <Button
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  text
                  @click="onRemoveItem(data)"
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

.type-icon {
  font-size: 0.85rem;
  color: var(--p-surface-500);
}
</style>

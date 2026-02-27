<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSelectedCards } from '../stores/selectedCards'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'

const router = useRouter()
const route = useRoute()
const selectedCards = useSelectedCards()

const hasCardsForSearch = computed(() => selectedCards.value.length > 0)

const entries = computed(() => [
  { label: 'Deck view', path: '/deck', enabled: true },
  { label: 'Search cards view', path: '/search', enabled: hasCardsForSearch.value },
])

const isActive = (path: string) => route.path === path

const handleNavigation = (entry: { path: string; enabled: boolean }) => {
  if (!entry.enabled || isActive(entry.path)) return
  router.push(entry.path)
}

const isDarkMode = ref(false)

onMounted(() => {
  isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('app-dark', isDarkMode.value)
})

watch(isDarkMode, (val) => {
  document.documentElement.classList.toggle('app-dark', val)
})
</script>

<template>
  <div class="sidebar-container sidebar-size">
    <img class="logo" src="/logo-vert.png" width="100%" />

    <nav class="nav-section">
      <p class="nav-label">Views</p>
      <Button
        v-for="entry in entries"
        :key="entry.path"
        :severity="isActive(entry.path) ? 'primary' : 'secondary'"
        :disabled="!entry.enabled"
        @click="handleNavigation(entry)"
      >
        <span>{{ entry.label }}</span>
      </Button>
    </nav>

    <div class="theme-section">
      <p class="nav-label">Theme</p>
      <div class="theme-toggle">
        <i class="pi pi-sun" />
        <ToggleSwitch v-model="isDarkMode" />
        <i class="pi pi-moon" />
      </div>
    </div>
  </div>
  <div class="sidebar-size"></div>
</template>

<style scoped lang="scss">
.sidebar-size {
  width: 150px;
  height: calc(100vh - 40px);
  max-width: 150px;
  min-width: 150px;
  margin: 20px;
}

.sidebar-container {
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-radius: 20px;

  background-color: var(--p-surface-100);

  .app-dark & {
    background-color: var(--p-surface-900);
  }

  .logo {
    border-radius: 20px 20px 0 0;
    width: 150px;
  }
}

.nav-section {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 0.75rem 1rem;
}

.nav-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #777;
  margin: 0 0 0.25rem;
}

.theme-section {
  margin-top: auto;
  padding: 0 0.75rem 1rem;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-text-muted-color);
}
</style>

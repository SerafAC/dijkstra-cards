<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSelectedCards } from '../stores/selectedCards'

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
</script>

<template>
  <div class="sidebar-container sidebar-size">
    <img class="logo" src="/public/logo-vert.png" width="100%" />

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
      </button>
    </nav>
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

  background-color: var(--p-surface-900);

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

.status-chip {
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid currentColor;
}
</style>

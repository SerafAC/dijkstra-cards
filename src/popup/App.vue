<script setup lang="ts">
import { onMounted } from 'vue'
import SideBar from './components/SideBar.vue'
import { StorageService } from './services/storageService'
import { setSearchIntervalMs } from './services/cardmarketService'

onMounted(async () => {
  const settings = await StorageService.getSettings()
  setSearchIntervalMs(settings.searchIntervalMs)
})
</script>

<template>
  <main class="app-main">
    <SideBar />
    <RouterView class="router-view" />
  </main>
</template>

<style lang="scss">
:root {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell',
    'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

main.app-main {
  display: flex;
}
.router-view {
  flex-grow: 2;
}
</style>

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
  <main>
    <SideBar />
    <RouterView class="router-view" />
  </main>
</template>

<style scoped lang="scss">
main {
  display: flex;
}
.router-view {
  flex-grow: 2;
}
</style>

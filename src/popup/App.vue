<script setup lang="ts">
import { useRouter } from 'vue-router'
import SideBar from './components/SideBar.vue'

const router = useRouter()
</script>

<template>
  <main>
    <SideBar v-if="router.currentRoute.value.fullPath != '/'" />
    <RouterView class="router-view" />
  </main>
</template>

<style scoped lang="scss">
main {
  display: flex;
  width: 100vw;
}
.router-view {
  flex-grow: 2;
}
</style>

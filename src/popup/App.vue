<script setup lang="ts">
import SideBar from './components/SideBar.vue'

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
  // width: 100vw;
}
.router-view {
  flex-grow: 2;
}
</style>

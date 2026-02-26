<script setup lang="ts">
  import router from './router'
</script>

<template>
  <main>
      <SideBar v-if="router.currentRoute.value.fullPath!='/'"/>
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

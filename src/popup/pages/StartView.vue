<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { CardService } from '../mocks/cardService'
import Image from 'primevue/image'
import Message from 'primevue/message'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

const router = useRouter()
const loading = ref(false)
const error = ref('')

async function onOpenDeck() {
  loading.value = true
  try {
    const result = await CardService.LoadCards()
    loading.value = false
    if (result) {
      router.push({ path: '/deck' })
    }
  } catch (er) {
    error.value = er as string
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <Image class="banner" src="/baner.png" width="100%" />

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
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  gap: 1rem;
}
.banner {
  width: 70%;
}
.card.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}
</style>

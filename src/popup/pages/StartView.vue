<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { CardService } from '../services/cardService'
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
    <div class="header">
      <Image class="banner" src="/baner.png" width="100%" />
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
    </div>
  </div>
</template>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  margin: 20px;
  height: 90vh;
  border-radius: 0 0 20px 20px;

  background-color: var(--p-surface-100);

  .app-dark & {
    background-color: var(--p-surface-900);
  }

  .content {
    display: flex;
    justify-content: space-around;
    flex-grow: 1;
  }
}
.banner {
  width: 70%;
}
</style>

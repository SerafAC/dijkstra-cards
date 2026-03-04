<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { StorageService, DEFAULT_SETTINGS } from '../services/storageService'
import { setSearchIntervalMs } from '../services/cardmarketService'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'

const searchIntervalSec = ref(DEFAULT_SETTINGS.searchIntervalMs / 1000)
const saved = ref(false)

onMounted(async () => {
  const settings = await StorageService.getSettings()
  searchIntervalSec.value = settings.searchIntervalMs / 1000
})

async function saveSettings() {
  const ms = searchIntervalSec.value * 1000
  await StorageService.saveSettings({ searchIntervalMs: ms })
  setSearchIntervalMs(ms)
  saved.value = true
  setTimeout(() => (saved.value = false), 2000)
}

async function resetToDefaults() {
  searchIntervalSec.value = DEFAULT_SETTINGS.searchIntervalMs / 1000
  await StorageService.saveSettings({ ...DEFAULT_SETTINGS })
  setSearchIntervalMs(DEFAULT_SETTINGS.searchIntervalMs)
  saved.value = true
  setTimeout(() => (saved.value = false), 2000)
}
</script>

<template>
  <div class="settings-page">
    <div class="header">
      <h2>Settings</h2>
    </div>

    <div class="settings-section">
      <h3>Search</h3>
      <div class="setting-row">
        <div class="setting-info">
          <label for="search-interval">Search interval</label>
          <small>Minimum time between requests to CardMarket (in seconds)</small>
        </div>
        <InputNumber
          id="search-interval"
          v-model="searchIntervalSec"
          :min="1"
          :max="60"
          :step="1"
          suffix=" s"
          showButtons
        />
      </div>
    </div>

    <div class="settings-actions">
      <Button
        label="Save"
        icon="pi pi-save"
        :severity="saved ? 'success' : 'primary'"
        :label="saved ? 'Saved!' : 'Save'"
        @click="saveSettings"
      />
      <Button
        label="Reset to defaults"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        @click="resetToDefaults"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../scss/mixins';

.settings-page {
  @include mixins.dc-container;
  min-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem 2rem 2rem;
  box-sizing: border-box;
}

.header {
  h2 {
    margin: 0;
  }
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);

  h3 {
    margin: 0 0 0.5rem;
  }
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  label {
    font-size: 0.95rem;
    font-weight: 600;
  }

  small {
    color: var(--text-color-secondary);
  }
}

.settings-actions {
  display: flex;
  gap: 0.5rem;
}
</style>

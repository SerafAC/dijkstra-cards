<template>
  <div class="popup-root">
    <div class="popup-content">
      <!-- Header -->
      <div class="popup-header">
        <img src="../assets/logo.svg" alt="Logo" class="popup-logo" />
        <h1 class="popup-title">Dijkstra Cards</h1>
      </div>

      <!-- Hello World Card -->
      <Card class="hello-card">
        <template #content>
          <div class="hello-body">
            <div class="hello-icon">
              <i class="pi pi-check-circle" />
            </div>
            <h2 class="hello-heading">Hello, World!</h2>
            <p class="hello-text">
              Your Vue&nbsp;3 browser extension is up and running.
            </p>
          </div>
        </template>

        <template #footer>
          <div class="hello-footer">
            <Button
              label="Get Started"
              icon="pi pi-arrow-right"
              icon-pos="right"
              fluid
              @click="onGetStarted"
            />
          </div>
        </template>
      </Card>

      <!-- Info chips -->
      <div class="badge-row">
        <Tag value="Vue 3" severity="info" icon="pi pi-code" />
        <Tag value="PrimeVue 4" severity="success" icon="pi pi-palette" />
        <Tag value="MV3" severity="warn" icon="pi pi-globe" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

function onGetStarted() {
  // Open extension options page or any URL
  chrome.tabs.create({ url: 'https://github.com/SerafAC/dijkstra-cards' })
}
</script>

<style scoped>
.popup-root {
  width: 360px;
  min-height: 300px;
  font-family: var(--p-font-family, sans-serif);
  background: var(--p-surface-ground, #f8f9fa);
}

.popup-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.popup-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.popup-logo {
  width: 32px;
  height: 32px;
}

.popup-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--p-text-color, #1e293b);
}

.hello-card {
  border-radius: 12px;
}

.hello-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  text-align: center;
}

.hello-icon {
  font-size: 2.5rem;
  color: var(--p-primary-color, #6366f1);
  line-height: 1;
}

.hello-icon .pi {
  font-size: 2.5rem;
}

.hello-heading {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--p-text-color, #1e293b);
}

.hello-text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--p-text-muted-color, #64748b);
}

.hello-footer {
  padding-top: 4px;
}

.badge-row {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>

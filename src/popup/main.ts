import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import 'primeicons/primeicons.css'
import App from './App.vue'

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      // Set to '.dark-mode' class or 'system' to enable dark mode support
      darkModeSelector: 'system',
    },
  },
})

app.mount('#app')

import { createApp } from 'vue'
import router from './router'
import App from './App.vue'
import PrimeVue from 'primevue/config'
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css';

const myPreset = definePreset(Aura, {
  semantic: {
        primary: {
            50: '{red.50}',
            100: '{red.100}',
            200: '{red.200}',
            300: '{red.300}',
            400: '{red.400}',
            500: '{red.500}',
            600: '{red.600}',
            700: '{red.700}',
            800: '{red.800}',
            900: '{red.900}',
            950: '{red.950}'
        }
    }
})

createApp(App)
  .use(router)
  .use(PrimeVue, {
    theme: {
      preset: myPreset,
    },
  })
  .mount('#app')

import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import 'primeicons/primeicons.css'
import router from './router'
import App from './App.vue'
import * as Sentry from '@sentry/vue'

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
      950: '{red.950}',
    },
  },
})

const app = createApp(App)

Sentry.init({
  app,
  dsn: 'https://f0d0c6603253303b001eed3c65edb4bb@o4511013569560576.ingest.de.sentry.io/4511014171181136',
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/vue/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration({ router }),
    Sentry.replayIntegration(),
    Sentry.feedbackIntegration({
      // Additional SDK configuration goes in here, for example:
      colorScheme: 'system',
    }),
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
  // Enable logs to be sent to Sentry
  enableLogs: true,
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
  tracesSampleRate: 1.0,
  // Set `tracePropagationTargets` to control for which URLs trace propagation should be enabled
  tracePropagationTargets: ['localhost'],
  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: myPreset,
    options: {
      darkModeSelector: '.app-dark',
    },
  },
})
app.directive('tooltip', Tooltip)

app.mount('#app')

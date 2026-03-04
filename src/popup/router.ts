import { createWebHashHistory, createRouter } from 'vue-router'

import StartView from './pages/StartView.vue'
import DeckView from './pages/DeckView.vue'
import SearchCardsPage from './pages/SearchCardsPage.vue'
import SettingsPage from './pages/SettingsPage.vue'

const routes = [
  { path: '/', component: StartView },
  { path: '/deck', component: DeckView },
  { path: '/search', component: SearchCardsPage },
  { path: '/settings', component: SettingsPage },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router

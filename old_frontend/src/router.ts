import { createWebHashHistory, createRouter } from 'vue-router'

import HomeView from './pages/StartView.vue'
import AboutView from './pages/AboutView.vue'
import DeckView from './pages/DeckView.vue'
import SearchCardsPage from './pages/SearchCardsPage.vue'

const routes = [
  { path: '/', component: HomeView },
  { path: '/about', component: AboutView },
  { path: '/deck', component: DeckView },
  { path: '/search', component: SearchCardsPage },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router

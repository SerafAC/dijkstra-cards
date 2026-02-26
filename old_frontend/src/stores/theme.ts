import { computed, ref, watch } from 'vue'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'dijkstra-cards-theme'

const getPreferredTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
  return prefersDark ? 'dark' : 'light'
}

const theme = ref<Theme>(getPreferredTheme())

const applyTheme = (value: Theme) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = value
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, value)
  }
}

applyTheme(theme.value)

watch(theme, (value) => {
  applyTheme(value)
})

const setTheme = (value: Theme) => {
  theme.value = value
}

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

export function useTheme() {
  return {
    theme,
    isDark: computed(() => theme.value === 'dark'),
    setTheme,
    toggleTheme,
  }
}

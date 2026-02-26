<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '../stores/theme'

type ThemeOption = {
  label: string
  value: 'light' | 'dark'
  icon: string
}

const { theme, setTheme } = useTheme()

const model = computed({
  get: () => theme.value,
  set: (value: 'light' | 'dark') => setTheme(value),
})

const options: ThemeOption[] = [
  { label: 'Light', value: 'light', icon: 'pi pi-sun' },
  { label: 'Dark', value: 'dark', icon: 'pi pi-moon' },
]
</script>

<template>
  <div class="theme-toggle" aria-label="Toggle theme">
    <SelectButton v-model="model" :options="options" :allowEmpty="false" class="theme-toggle__select">
      <template #option="slotProps">
        <div class="theme-toggle__option">
          <i :class="slotProps.option.icon" aria-hidden="true" />
          <span>{{ slotProps.option.label }}</span>
        </div>
      </template>
    </SelectButton>
  </div>
</template>

<style scoped lang="scss">
.theme-toggle {
  display: flex;
  align-items: center;

  &__select :deep(.p-selectbutton) {
    background: transparent;
    border: 1px solid var(--surface-border);
  }

  &__option {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.1rem 0.4rem;
    font-size: 0.85rem;
  }
}
</style>

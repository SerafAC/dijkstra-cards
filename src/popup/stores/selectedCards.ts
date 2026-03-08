import { Ref, ref } from 'vue'
import { Card } from '../types/models'

const selectedCards = ref<Card[]>([])
const currentDeckFileName = ref<string>('')

export function saveSelectedCards(cards: Card[], deckFileName?: string) {
  selectedCards.value = cards
  if (deckFileName !== undefined) currentDeckFileName.value = deckFileName
}

export function useSelectedCards(): Ref<Card[]> {
  return selectedCards
}

export function getStoredDeckFileName(): string {
  return currentDeckFileName.value
}

export function clearSelectedCards() {
  selectedCards.value = []
}

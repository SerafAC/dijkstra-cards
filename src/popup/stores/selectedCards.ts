import { Ref, ref } from 'vue'
import { Card } from '../types/models'

const selectedCards = ref<Card[]>([])

export function saveSelectedCards(cards: Card[]) {
  selectedCards.value = cards
}

export function useSelectedCards(): Ref<Card[]> {
  return selectedCards
}

export function clearSelectedCards() {
  selectedCards.value = []
}

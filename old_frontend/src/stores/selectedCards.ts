import { Ref, ref } from 'vue'
import { Card } from '../../bindings/dijkstra-cards/src/models'

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

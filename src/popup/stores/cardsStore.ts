import { Ref, ref } from 'vue'
import { Card } from '../types/models'

const allCards = ref<Card[]>([])
const selectedCards = ref<Card[]>([])
const currentDeckFileName = ref<string>('')
const csvContent = ref<string>('')

export function saveDeckState(cards: Card[], fileName: string, csv: string) {
  allCards.value = cards
  currentDeckFileName.value = fileName
  csvContent.value = csv
}

export function useAllCards(): Ref<Card[]> {
  return allCards
}

export function getCsvContent(): string {
  return csvContent.value
}

export function getStoredDeckFileName(): string {
  return currentDeckFileName.value
}

export function saveSelectedCards(cards: Card[], deckFileName?: string) {
  selectedCards.value = cards
  if (deckFileName !== undefined) currentDeckFileName.value = deckFileName
}

export function useSelectedCards(): Ref<Card[]> {
  return selectedCards
}

export function clearSelectedCards() {
  selectedCards.value = []
}

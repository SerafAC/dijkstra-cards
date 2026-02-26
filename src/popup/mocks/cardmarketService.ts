import type { CardQuery, Seller, SellerFetchStatus } from '../types/models'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GetCardSellers(query: CardQuery): Promise<Seller[]> {
  // Mock: simulate a network request with a delay
  await delay(300 + Math.random() * 200)
  console.log('[Mock] GetCardSellers called for:', query.Card.CardName)
  return []
}

export async function GetFetchStatuses(cardIDs: string[]): Promise<SellerFetchStatus[]> {
  return cardIDs.map((id) => ({
    cardId: id,
    hadError: true,
    errorMessage: 'Mock: cardmarket integration not available yet',
    sellersFound: false,
    fetchAttempted: true,
  }))
}

export function Test(): void {
  console.log('[Mock] Test called')
}

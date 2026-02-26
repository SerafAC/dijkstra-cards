import type { Card, Seller } from '../types/models'

export async function FindOptimalSellers(
  _cards: Card[],
): Promise<Record<string, Seller>> {
  // Mock: no real seller assignment logic yet
  console.log('[Mock] FindOptimalSellers called')
  return {}
}

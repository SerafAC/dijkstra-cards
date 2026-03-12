import type { Card, Seller } from '../types/models'

interface SellerCoverage {
  sellerKey: string
  cardSellers: Map<string, Seller>
}

function sellerKey(listing: Seller): string {
  const name = listing.SellerName.trim().toLowerCase()
  const country = listing.SellerCountry.trim().toLowerCase()
  if (!country) return name
  return `${name}|${country}`
}

/**
 * Builds a map from seller key → the cards that seller offers, keeping only
 * the cheapest listing per (seller, card) pair.
 */
function buildSellerCoverage(offers: Map<string, Seller[]>): Map<string, SellerCoverage> {
  const coverage = new Map<string, SellerCoverage>()

  for (const [cardId, sellers] of offers) {
    for (const seller of sellers) {
      const key = sellerKey(seller)
      let entry = coverage.get(key)
      if (!entry) {
        entry = { sellerKey: key, cardSellers: new Map() }
        coverage.set(key, entry)
      }

      // Keep only the cheapest listing for this card from this seller
      const current = entry.cardSellers.get(cardId)
      if (!current || seller.Price < current.Price) {
        entry.cardSellers.set(cardId, seller)
      }
    }
  }

  return coverage
}

/**
 * Finds the seller that covers the most unassigned cards.
 * Ties are broken by lowest combined price across those cards.
 * Returns the seller key and the number of unassigned cards it covers.
 */
function selectBestSeller(
  coverage: Map<string, SellerCoverage>,
  assigned: Set<string>
): [string, number] {
  let bestKey = ''
  let bestCount = 0
  let bestPrice = Infinity

  for (const [key, entry] of coverage) {
    let count = 0
    let totalPrice = 0

    for (const [cardId, seller] of entry.cardSellers) {
      if (assigned.has(cardId)) continue
      count++
      totalPrice += seller.Price
    }

    if (count === 0) continue

    if (count > bestCount || (count === bestCount && totalPrice < bestPrice)) {
      bestKey = key
      bestCount = count
      bestPrice = totalPrice
    }
  }

  return [bestKey, bestCount]
}

/**
 * Greedy set-cover algorithm: repeatedly picks the seller covering the most
 * unassigned cards (ties broken by lowest total price), until all cards with
 * available sellers are assigned. Any cards still unassigned afterwards are
 * assigned to their first available seller as a fallback.
 */
export async function FindOptimalSellers(
  cards: Card[],
  offersMap: Map<string, Seller[]>
): Promise<Record<string, Seller>> {
  if (cards.length === 0) {
    console.error('[SellerAssignmentService] FindOptimalSellers: no cards provided for assignment')
    throw new Error('no cards provided for assignment')
  }

  const optimalCardSeller: Record<string, Seller> = {}
  const offers = new Map<string, Seller[]>()

  for (const card of cards) {
    const cardSellers = offersMap.get(card.Id) ?? []
    if (cardSellers.length > 0) {
      offers.set(card.Id, cardSellers)
    }
  }

  const coverage = buildSellerCoverage(offers)
  const assigned = new Set<string>()

  while (assigned.size < cards.length) {
    const [bestKey, count] = selectBestSeller(coverage, assigned)
    if (!bestKey || count === 0) break

    const sellerInfo = coverage.get(bestKey)!
    for (const [cardId, seller] of sellerInfo.cardSellers) {
      if (assigned.has(cardId)) continue
      optimalCardSeller[cardId] = seller
      assigned.add(cardId)
    }
  }

  // Assign remaining cards to their first available seller
  for (const card of cards) {
    if (assigned.has(card.Id)) continue
    const cardOffers = offers.get(card.Id)
    if (!cardOffers || cardOffers.length === 0) continue
    optimalCardSeller[card.Id] = cardOffers[0]
  }

  return optimalCardSeller
}

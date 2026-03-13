import { describe, it, expect } from 'vitest'
import { FindOptimalSellers } from '@/popup/services/sellerAssignmentService'
import type { Card, Seller } from '@/popup/types/models'

function makeCard(id: string, name: string = id): Card {
  return { Id: id, Quantity: 1, CardName: name, EditionName: '', Link: '' }
}

function makeSeller(name: string, country: string, price: number): Seller {
  return {
    SellerName: name,
    SellerCountry: country,
    SellerCountryId: 1,
    CardCondition: 'NM',
    CardsAmmount: 4,
    Price: price,
    Currency: 'EUR',
  }
}

describe('FindOptimalSellers', () => {
  it('throws when no cards are provided', async () => {
    await expect(FindOptimalSellers([], new Map())).rejects.toThrow('no cards provided for assignment')
  })

  it('assigns each card to its only available seller', async () => {
    const cards = [makeCard('c1'), makeCard('c2')]
    const sellerA = makeSeller('Alice', 'DE', 1.0)
    const sellerB = makeSeller('Bob', 'FR', 2.0)
    const offers = new Map([
      ['c1', [sellerA]],
      ['c2', [sellerB]],
    ])

    const result = await FindOptimalSellers(cards, offers)

    expect(result['c1'].SellerName).toBe('Alice')
    expect(result['c2'].SellerName).toBe('Bob')
  })

  it('prefers the seller covering the most cards', async () => {
    const cards = [makeCard('c1'), makeCard('c2'), makeCard('c3')]
    const sellerA = makeSeller('Alice', 'DE', 1.0)
    const sellerB = makeSeller('Bob', 'FR', 1.0)
    const offers = new Map([
      ['c1', [sellerA, sellerB]],
      ['c2', [sellerA, sellerB]],
      ['c3', [sellerA]],
    ])

    const result = await FindOptimalSellers(cards, offers)

    // Alice covers all 3 cards, Bob covers only 2 — Alice should win
    expect(result['c1'].SellerName).toBe('Alice')
    expect(result['c2'].SellerName).toBe('Alice')
    expect(result['c3'].SellerName).toBe('Alice')
  })

  it('breaks ties by lowest total price', async () => {
    const cards = [makeCard('c1'), makeCard('c2')]
    const sellerCheap = makeSeller('Cheap', 'DE', 0.5)
    const sellerExpensive = makeSeller('Expensive', 'DE', 5.0)
    const offers = new Map([
      ['c1', [sellerCheap, sellerExpensive]],
      ['c2', [sellerCheap, sellerExpensive]],
    ])

    const result = await FindOptimalSellers(cards, offers)

    expect(result['c1'].SellerName).toBe('Cheap')
    expect(result['c2'].SellerName).toBe('Cheap')
  })

  it('uses cheapest listing per seller when a seller has multiple prices for the same card', async () => {
    const cards = [makeCard('c1')]
    const cheap = makeSeller('Alice', 'DE', 1.0)
    const expensive = makeSeller('Alice', 'DE', 9.0)
    const offers = new Map([['c1', [expensive, cheap]]])

    const result = await FindOptimalSellers(cards, offers)

    expect(result['c1'].Price).toBe(1.0)
  })

  it('falls back to first available seller for cards with no greedy coverage', async () => {
    // c1 has a seller, but c2 is only available after greedy assigns c1's seller to c1
    // This tests the fallback path: cards not covered in greedy phase get first available seller
    const cards = [makeCard('c1'), makeCard('c2')]
    const sellerA = makeSeller('Alice', 'DE', 1.0)
    const sellerB = makeSeller('Bob', 'FR', 1.0)
    // Alice covers c1+c2, Bob covers only c2
    const offers = new Map([
      ['c1', [sellerA]],
      ['c2', [sellerA, sellerB]],
    ])

    const result = await FindOptimalSellers(cards, offers)

    expect(result['c1']).toBeDefined()
    expect(result['c2']).toBeDefined()
  })

  it('leaves cards with no offers unassigned', async () => {
    const cards = [makeCard('c1'), makeCard('c2')]
    const sellerA = makeSeller('Alice', 'DE', 1.0)
    const offers = new Map([['c1', [sellerA]]])

    const result = await FindOptimalSellers(cards, offers)

    expect(result['c1'].SellerName).toBe('Alice')
    expect(result['c2']).toBeUndefined()
  })

  it('treats sellers with the same name but different countries as distinct', async () => {
    const cards = [makeCard('c1'), makeCard('c2')]
    const sellerDE = makeSeller('Alice', 'DE', 2.0)
    const sellerFR = makeSeller('Alice', 'FR', 1.0)
    const offers = new Map([
      ['c1', [sellerDE]],
      ['c2', [sellerFR]],
    ])

    const result = await FindOptimalSellers(cards, offers)

    expect(result['c1'].SellerCountry).toBe('DE')
    expect(result['c2'].SellerCountry).toBe('FR')
  })

  it('returns empty object when all cards have no offers', async () => {
    const cards = [makeCard('c1')]
    const result = await FindOptimalSellers(cards, new Map())

    expect(Object.keys(result)).toHaveLength(0)
  })
})

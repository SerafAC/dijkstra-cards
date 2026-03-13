import { describe, it, expect, vi } from 'vitest'

// Mock modules that parseCSV doesn't use but are imported by the module
vi.mock('@/popup/services/cardmarketService', () => ({
  BuildCardPageURL: vi.fn((card) => `https://example.com/${card.CardName}`),
}))
vi.mock('@/popup/services/storageService', () => ({
  StorageService: { addRecentDeck: vi.fn() },
}))
vi.mock('@/popup/stores/cardsStore', () => ({
  saveDeckState: vi.fn(),
}))

import { parseCSV } from '@/popup/services/cardService'

describe('parseCSV', () => {
  it('returns empty array for header-only input', () => {
    expect(parseCSV('Quantity,CardName,EditionName,Link')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseCSV('')).toEqual([])
  })

  it('parses a basic comma-separated CSV', () => {
    const csv = 'Quantity,CardName,EditionName,Link\n2,Lightning Bolt,Alpha,https://example.com'
    const cards = parseCSV(csv)

    expect(cards).toHaveLength(1)
    expect(cards[0].Quantity).toBe(2)
    expect(cards[0].CardName).toBe('Lightning Bolt')
    expect(cards[0].EditionName).toBe('Alpha')
    expect(cards[0].Link).toBe('https://example.com')
  })

  it('parses a semicolon-separated CSV', () => {
    const csv = 'Quantity;CardName;EditionName\n1;Dark Ritual;Alpha'
    const cards = parseCSV(csv)

    expect(cards).toHaveLength(1)
    expect(cards[0].CardName).toBe('Dark Ritual')
    expect(cards[0].EditionName).toBe('Alpha')
  })

  it('defaults Quantity to 1 when missing', () => {
    const csv = 'CardName\nCounterspell'
    const cards = parseCSV(csv)

    expect(cards[0].Quantity).toBe(1)
  })

  it('defaults Quantity to 1 when value is not a number', () => {
    const csv = 'Quantity,CardName\nabc,Force of Will'
    const cards = parseCSV(csv)

    expect(cards[0].Quantity).toBe(1)
  })

  it('skips rows with empty card name', () => {
    const csv = 'Quantity,CardName\n1,Brainstorm\n2,\n1,Ponder'
    const cards = parseCSV(csv)

    expect(cards).toHaveLength(2)
    expect(cards.map((c) => c.CardName)).toEqual(['Brainstorm', 'Ponder'])
  })

  it('accepts alternative column names: Qty and Name', () => {
    const csv = 'Qty,Name\n3,Snapcaster Mage'
    const cards = parseCSV(csv)

    expect(cards).toHaveLength(1)
    expect(cards[0].Quantity).toBe(3)
    expect(cards[0].CardName).toBe('Snapcaster Mage')
  })

  it('accepts alternative column names: Amount, Card, Set, URL', () => {
    const csv = 'Amount,Card,Set,URL\n2,Tarmogoyf,Future Sight,https://cm.com'
    const cards = parseCSV(csv)

    expect(cards[0].Quantity).toBe(2)
    expect(cards[0].CardName).toBe('Tarmogoyf')
    expect(cards[0].EditionName).toBe('Future Sight')
    expect(cards[0].Link).toBe('https://cm.com')
  })

  it('strips surrounding quotes from values', () => {
    const csv = '"Quantity","CardName"\n"1","Mox Pearl"'
    const cards = parseCSV(csv)

    expect(cards[0].CardName).toBe('Mox Pearl')
    expect(cards[0].Quantity).toBe(1)
  })

  it('assigns a unique UUID to each card', () => {
    const csv = 'CardName\nIce\nFire'
    const cards = parseCSV(csv)
    const ids = cards.map((c) => c.Id)

    expect(ids[0]).not.toBe(ids[1])
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('parses multiple cards', () => {
    const csv = [
      'Quantity,CardName,EditionName',
      '1,Arcane Signet,Commander 2019',
      '2,Blasphemous Act,Innistrad',
      '4,Cloud Key,Future Sight',
    ].join('\n')

    const cards = parseCSV(csv)

    expect(cards).toHaveLength(3)
    expect(cards[2].CardName).toBe('Cloud Key')
    expect(cards[2].Quantity).toBe(4)
  })

  it('defaults EditionName and Link to empty string when columns are absent', () => {
    const csv = 'CardName\nMindslaver'
    const cards = parseCSV(csv)

    expect(cards[0].EditionName).toBe('')
    expect(cards[0].Link).toBe('')
  })

  it('skips blank lines', () => {
    const csv = 'CardName\nWrath of God\n\nDay of Judgment'
    const cards = parseCSV(csv)

    expect(cards).toHaveLength(2)
  })
})

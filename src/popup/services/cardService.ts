import type { Card } from '../types/models'
import { BuildCardPageURL } from './cardmarketService'
import { StorageService } from './storageService'

let storedCards: Card[] = []

function generateId(): string {
  return crypto.randomUUID()
}

function parseCSV(text: string): Card[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headerLine = lines[0]
  const separator = headerLine.includes(';') ? ';' : ','
  const headers = headerLine.split(separator).map((h) => h.trim().replace(/^"|"$/g, ''))

  const findCol = (names: string[]) =>
    headers.findIndex((h) => names.some((n) => h.toLowerCase() === n.toLowerCase()))

  const qtyIdx = findCol(['Quantity', 'Qty', 'Amount'])
  const nameIdx = findCol(['CardName', 'Card Name', 'Name', 'Card'])
  const editionIdx = findCol(['EditionName', 'Edition Name', 'Edition', 'Set'])
  const linkIdx = findCol(['Link', 'URL', 'Market Link'])

  const cards: Card[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ''))

    const cardName = nameIdx >= 0 ? cols[nameIdx] : ''
    if (!cardName) continue

    cards.push({
      Id: generateId(),
      Quantity: qtyIdx >= 0 ? parseInt(cols[qtyIdx], 10) || 1 : 1,
      CardName: cardName,
      EditionName: editionIdx >= 0 ? cols[editionIdx] || '' : '',
      Link: linkIdx >= 0 ? cols[linkIdx] || '' : '',
    })
  }

  return cards
}

async function loadFromCSV(csvContent: string, fileName: string): Promise<boolean> {
  const cards = parseCSV(csvContent)
  if (cards.length === 0) return false
  storedCards = cards
  for (const card of storedCards) {
    card.Link = BuildCardPageURL(card)
  }
  await StorageService.addRecentDeck(fileName, csvContent, storedCards.length)
  return true
}

export const CardService = {
  LoadCards(): Promise<boolean> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.csv'

      input.addEventListener('change', async () => {
        const file = input.files?.[0]
        if (!file) {
          resolve(false)
          return
        }
        try {
          const text = await file.text()
          resolve(await loadFromCSV(text, file.name))
        } catch {
          resolve(false)
        }
      })

      input.addEventListener('cancel', () => resolve(false))
      input.click()
    })
  },

  async LoadFromRecent(csvContent: string, fileName: string): Promise<boolean> {
    try {
      return await loadFromCSV(csvContent, fileName)
    } catch {
      return false
    }
  },

  GetCards(): Promise<Card[]> {
    return Promise.resolve([...storedCards])
  },
}

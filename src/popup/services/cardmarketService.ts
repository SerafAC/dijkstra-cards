import type { Card, CardQuery, Seller } from '../types/models'
import { openBrowsingTab, closeBrowsingTab, searchCardViaTab } from './tabFetchService'
import { sleep } from '../utils/async'

const defaultBaseURL = 'https://www.cardmarket.com/en/Magic/Products/Singles/'
const defaultRootURL = 'https://www.cardmarket.com/en/Magic'

// --- URL building ---

function encodeParam(param: string): string {
  return param.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-')
}

export function BuildCardPageURL(card: Card): string {
  const cardName = encodeParam(card.CardName)
  const setName = encodeParam(card.EditionName)
  return `${defaultBaseURL}${setName}/${cardName}`
}

// --- HTML parsing (ported from Go goquery-based implementation) ---

function extractSellerName(row: Element): string {
  const anchor = row.querySelector('.seller-name a')
  if (anchor) {
    const name = (anchor.textContent || '').trim()
    if (name) return name
  }
  const sellerName = row.querySelector('.seller-name')
  return sellerName ? (sellerName.textContent || '').trim() : ''
}

function normalizeCountryLabel(val: string): string {
  val = val.replace('Item location:', '').trim()
  const idx = val.lastIndexOf(':')
  if (idx !== -1) {
    val = val.substring(idx + 1).trim()
  }
  return val
}

function extractSellerCountry(row: Element): string {
  const icon1 = row.querySelector('.seller-info .icon[aria-label^="Item location"]')
  if (icon1) {
    const label = icon1.getAttribute('aria-label')
    if (label) return normalizeCountryLabel(label)
  }
  const icon2 = row.querySelector('.seller-info .icon[aria-label]')
  if (icon2) {
    const label = icon2.getAttribute('aria-label')
    if (label) return normalizeCountryLabel(label)
  }
  const icon3 = row.querySelector('.seller-info .icon')
  if (icon3) {
    const tooltip = icon3.getAttribute('data-bs-original-title')
    if (tooltip) return normalizeCountryLabel(tooltip)
  }
  return ''
}

function extractCardCondition(row: Element): string {
  const badge = row.querySelector('.article-condition .badge')
  if (badge) {
    const condition = (badge.textContent || '').trim()
    if (condition) return condition
  }
  const condEl = row.querySelector('.article-condition')
  if (condEl) {
    const tooltip = condEl.getAttribute('data-bs-original-title')
    if (tooltip) return tooltip.trim()
  }
  return ''
}

function extractCardsAmount(row: Element): number {
  const itemCount = row.querySelector('.amount-container .item-count')
  if (!itemCount) return 0
  let amountText = (itemCount.textContent || '').trim()
  if (!amountText) return 0
  amountText = amountText.replace(/\./g, '').replace(/,/g, '')
  const value = parseInt(amountText, 10)
  return isNaN(value) ? 0 : value
}

function normalizeDecimalString(number: string): string {
  const lastComma = number.lastIndexOf(',')
  const lastDot = number.lastIndexOf('.')

  if (lastComma > lastDot) {
    number = number.replace(/\./g, '').replace(/,/g, '.')
  } else if (lastDot > lastComma) {
    number = number.replace(/,/g, '')
  } else {
    number = number.replace(/,/g, '.')
  }

  return number
}

function parsePriceCurrency(raw: string): [number, string] {
  const cleaned = raw.replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ').trim()
  if (!cleaned) throw new Error('empty price string')

  let numeric = ''
  let currency = ''

  for (const ch of cleaned) {
    if (/\d/.test(ch) || ch === ',' || ch === '.') {
      numeric += ch
    } else if (/\p{L}/u.test(ch) || /\p{S}/u.test(ch)) {
      currency += ch
    }
  }

  if (!numeric) throw new Error(`price value not found in "${raw}"`)

  const normalized = normalizeDecimalString(numeric)
  const value = parseFloat(normalized)
  if (isNaN(value)) throw new Error(`parsing "${normalized}" as price`)

  currency = currency.trim()
  if (!currency) {
    const parts = cleaned.split(/\s+/)
    if (parts.length > 1) {
      currency = parts[parts.length - 1]
    }
  }

  return [value, currency]
}

function extractPriceAndCurrency(row: Element): [number, string] {
  let priceEl = row.querySelector('.price-container .color-primary')
  if (!priceEl) {
    priceEl = row.querySelector('.mobile-offer-container .color-primary')
  }
  if (!priceEl) throw new Error('price not found')
  const priceText = (priceEl.textContent || '').trim()
  if (!priceText) throw new Error('price not found')
  return parsePriceCurrency(priceText)
}

export function ParseSellerListings(body: string): Seller[] {
  if (!body.trim()) {
    throw new Error('empty cardmarket body')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(body, 'text/html')
  const rows = doc.querySelectorAll('div.article-table div.article-row')
  const listings: Seller[] = []

  rows.forEach((row) => {
    const listing: Seller = {
      SellerName: extractSellerName(row),
      SellerCountry: extractSellerCountry(row),
      CardCondition: extractCardCondition(row),
      CardsAmmount: extractCardsAmount(row),
      Price: 0,
      Currency: '',
    }

    try {
      const [price, currency] = extractPriceAndCurrency(row)
      listing.Price = price
      listing.Currency = currency
    } catch {
      // Unable to parse price for this seller row
    }

    if (!listing.SellerName && listing.Price === 0 && listing.CardsAmmount === 0) {
      return
    }

    listings.push(listing)
  })

  return listings
}

// --- Browsing session ---

let browsingTabId: number | null = null

async function ensureBrowsingTab(): Promise<number> {
  if (browsingTabId != null) return browsingTabId
  browsingTabId = await openBrowsingTab(defaultRootURL)
  return browsingTabId
}

export function closeBrowsingSession(): void {
  if (browsingTabId != null) {
    closeBrowsingTab(browsingTabId)
    browsingTabId = null
  }
}

// --- Page fetching ---

let searchIntervalMs = 5_000
let lastFetchTime = 0

export function setSearchIntervalMs(ms: number): void {
  searchIntervalMs = ms
}

async function queryCardPage(query: CardQuery): Promise<{ html: string; url: string }> {
  if (!query.Card.CardName.trim()) {
    throw new Error('card name is required')
  }

  const elapsed = Date.now() - lastFetchTime
  if (lastFetchTime > 0 && elapsed < searchIntervalMs) {
    await sleep(searchIntervalMs - elapsed)
  }

  const tabId = await ensureBrowsingTab()

  const result = await searchCardViaTab(
    tabId,
    query.Card.CardName,
    query.Card.EditionName,
    query.Filters,
    (h) => h.includes('Sammelkartenmarkt'),
  )
  lastFetchTime = Date.now()
  return result
}

// --- Public API ---

export async function GetCardSellers(query: CardQuery): Promise<Seller[]> {
  const { html: body, url: cardUrl } = await queryCardPage(query)

  const sellers = ParseSellerListings(body)

  if (sellers.length === 0) {
    throw new Error('Sellers not found: Empty list')
  }

  query.Card.Link = cardUrl
  return sellers.map((s) => ({ ...s }))
}


import type { Card, CardQuery, Seller, SellerFetchStatus } from '../types/models'
import { openBrowsingTab, closeBrowsingTab, fetchViaTab } from './tabFetchService'

const defaultBaseURL = 'https://www.cardmarket.com/en/Magic/Products/Singles/'
const defaultRootURL = 'https://www.cardmarket.com'

// --- Cache ---

interface SellerCacheEntry {
  listings: Seller[]
  fetchErr: string | null
  fetched: boolean
}

const sellerCache = new Map<string, SellerCacheEntry>()
const fetchStatusCache = new Map<string, SellerFetchStatus>()

function cloneSellerListings(listings: Seller[]): Seller[] {
  if (listings.length === 0) return []
  return listings.map((s) => ({ ...s }))
}

function recordFetchStatus(status: SellerFetchStatus): void {
  fetchStatusCache.set(status.cardId, { ...status })
}

function storePrefetchedSellers(key: string, listings: Seller[]): void {
  sellerCache.set(key, {
    listings: cloneSellerListings(listings),
    fetchErr: null,
    fetched: true,
  })
  recordFetchStatus({
    cardId: key,
    hadError: false,
    sellersFound: listings.length > 0,
    fetchAttempted: true,
  })
}

function storePrefetchedError(key: string, err: string): void {
  sellerCache.set(key, {
    listings: [],
    fetchErr: err,
    fetched: true,
  })
  recordFetchStatus({
    cardId: key,
    hadError: true,
    errorMessage: err,
    sellersFound: false,
    fetchAttempted: true,
  })
}

// --- URL building ---

function encodeParam(param: string): string {
  return param.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-')
}

export function BuildCardPageURL(card: Card): string {
  const cardName = encodeParam(card.CardName)
  const setName = encodeParam(card.EditionName)
  return `${defaultBaseURL}${setName}/${cardName}`
}

function BuildSearchURL(query: CardQuery): string {
  const cardName = encodeParam(query.Card.CardName)
  const editionName = encodeParam(query.Card.EditionName)
  return `${defaultBaseURL}${editionName}/${cardName}`
}

// --- Seller cache lookup ---

export function GetCachedSellers(key: string): [Seller[], boolean] {
  const entry = sellerCache.get(key)
  if (!entry) {
    return [[], false]
  }
  if (entry.fetchErr) {
    return [[], false]
  }
  return [cloneSellerListings(entry.listings), true]
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

const SEARCH_INTERVAL_MS = 5_000
let lastFetchTime = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function queryCardPage(query: CardQuery): Promise<string> {
  if (!query.Card.CardName.trim()) {
    throw new Error('card name is required')
  }

  const elapsed = Date.now() - lastFetchTime
  if (lastFetchTime > 0 && elapsed < SEARCH_INTERVAL_MS) {
    await sleep(SEARCH_INTERVAL_MS - elapsed)
  }

  const tabId = await ensureBrowsingTab()
  const targetURL = BuildSearchURL(query)

  const html = await fetchViaTab(tabId, targetURL, (h) => h.includes('Sammelkartenmarkt'))
  lastFetchTime = Date.now()
  return html
}

// --- Public API ---

export async function GetCardSellers(query: CardQuery): Promise<Seller[]> {
  const key = query.Card.Id

  const [cached, ok] = GetCachedSellers(key)
  if (ok) {
    return cached
  }

  let body: string
  try {
    body = await queryCardPage(query)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    storePrefetchedError(key, msg)
    throw err
  }

  let sellers: Seller[]
  try {
    sellers = ParseSellerListings(body)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    storePrefetchedError(key, msg)
    throw err
  }

  if (sellers.length === 0) {
    const msg = 'Sellers not found: Empty list'
    storePrefetchedError(key, msg)
    throw new Error(msg)
  }

  storePrefetchedSellers(key, sellers)
  return cloneSellerListings(sellers)
}

export async function GetFetchStatuses(cardIDs: string[]): Promise<SellerFetchStatus[]> {
  return cardIDs.map((id) => {
    const status = fetchStatusCache.get(id)
    if (status) {
      return { ...status }
    }
    return {
      cardId: id,
      hadError: false,
      errorMessage: '',
      sellersFound: false,
      fetchAttempted: false,
    }
  })
}

export function Test(): void {
  console.log('[cardmarketService] Test called')
}

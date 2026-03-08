export interface Card {
  Id: string
  Quantity: number
  CardName: string
  EditionName: string
  Link: string
  LastUpdated?: string
}

export interface Seller {
  SellerName: string
  SellerCountry: string
  SellerCountryId: number
  CardCondition: string
  CardsAmmount: number
  Price: number
  Currency: string
}

export interface CardFilters {
  language: number[]
  minCondition: number | null
  sellerCountry: number[]
}

export interface CardQuery {
  Card: Card
  Language: string
  ShipmentDestination: string
  Filters?: CardFilters
}

export interface SellerFetchStatus {
  cardId: string
  hadError: boolean
  errorMessage?: string
  sellersFound: boolean
  fetchAttempted: boolean
}

export interface RecentDeck {
  fileName: string
  csvContent: string
  cardCount: number
  loadedAt: string
}

export interface RecentProject {
  fileName: string
  projectContent: string
  cardCount: number
  loadedAt: string
}

export interface AppSettings {
  searchIntervalMs: number
}

export interface PersistedAssignment {
  cardName: string
  editionName: string
  seller: Seller
  lastUpdated?: string
}

export interface PersistedError {
  cardName: string
  editionName: string
  errorMessage: string
}

export interface PersistedSearchResults {
  deckFileName: string
  assignments: PersistedAssignment[]
  errors: PersistedError[]
}

export interface ProjectFile {
  version: 1
  deckFileName: string
  csvContent: string
  selectedCards: { cardName: string; editionName: string }[]
  filters: CardFilters | null
  assignments: PersistedAssignment[]
  errors: PersistedError[]
}

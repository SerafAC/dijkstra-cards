export interface Card {
  Id: string
  Quantity: number
  CardName: string
  EditionName: string
  Link: string
}

export interface Seller {
  SellerName: string
  SellerCountry: string
  CardCondition: string
  CardsAmmount: number
  Price: number
  Currency: string
}

export interface CardFilters {
  language: number[]
  minCondition: number | null
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

export interface PersistedAssignment {
  cardName: string
  editionName: string
  seller: Seller
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

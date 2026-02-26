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

export interface CardQuery {
  Card: Card
  Language: string
  ShipmentDestination: string
}

export interface SellerFetchStatus {
  cardId: string
  hadError: boolean
  errorMessage?: string
  sellersFound: boolean
  fetchAttempted: boolean
}

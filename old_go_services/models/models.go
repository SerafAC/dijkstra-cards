package models

type Card struct {
	Id          string
	Quantity    uint   `csv:"quantity"`
	CardName    string `csv:"card name"`
	EditionName string `csv:"edition name"`
	Link        string
}

type Seller struct {
	SellerName    string
	SellerCountry string
	CardCondition string
	CardsAmmount  uint
	Price         float64
	Currency      string
}

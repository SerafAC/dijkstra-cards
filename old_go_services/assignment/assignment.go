package assignment

import (
	"fmt"
	"log"
	"math"
	"strings"

	"dijkstra-cards/src/models"
)

type SellerProvider interface {
	GetCachedSellers(cardId string) ([]models.Seller, bool)
}

type SellerAssignmentService struct {
	provider          SellerProvider
	optimalCardSeller map[string]models.Seller
}

func NewSellerAssignmentService(provider SellerProvider) *SellerAssignmentService {
	return &SellerAssignmentService{provider: provider}
}

func (s *SellerAssignmentService) FindOptimalSellers(cards []models.Card) (map[string]models.Seller, error) {
	if len(cards) == 0 {
		return nil, fmt.Errorf("no cards provided for assignment")
	}

	s.optimalCardSeller = make(map[string]models.Seller)
	offers := make(map[string][]models.Seller)

	for _, card := range cards {
		cardSellers, _ := s.provider.GetCachedSellers(card.Id)
		if cardSellers != nil {
			offers[card.Id] = cardSellers
		} else {
			log.Printf(">>> Card %s (key: %s) not in the cache!", card.CardName, card.Id)
		}
	}

	coverage := buildSellerCoverage(offers)
	assigned := make(map[string]struct{})

	for len(assigned) < len(cards) {
		sellerKey, count := selectBestSeller(coverage, assigned)
		if sellerKey == "" || count == 0 {
			break
		}

		sellerInfo := coverage[sellerKey]
		for cardId, seller := range sellerInfo.cardSellers {
			if _, exists := assigned[cardId]; exists {
				continue
			}

			s.optimalCardSeller[cardId] = seller
			assigned[cardId] = struct{}{}
		}
	}

	// Assign remaining cards to their next best available seller (if any)
	for _, card := range cards {
		if _, exists := assigned[card.Id]; exists {
			continue
		}

		if len(offers[card.Id]) == 0 {
			continue
		}

		s.optimalCardSeller[card.Id] = offers[card.Id][0]
	}

	return s.optimalCardSeller, nil
}

type sellerCoverage struct {
	sellerKey   string
	cardSellers map[string]models.Seller
}

func buildSellerCoverage(offers map[string][]models.Seller) map[string]*sellerCoverage {
	coverage := make(map[string]*sellerCoverage)

	for cardId, sellers := range offers {
		for _, seller := range sellers {
			key := sellerKey(seller)
			entry, ok := coverage[key]
			if !ok {
				entry = &sellerCoverage{
					sellerKey:   key,
					cardSellers: make(map[string]models.Seller),
				}
				coverage[key] = entry
			}

			current, exists := entry.cardSellers[cardId]
			if !exists || seller.Price < current.Price {
				entry.cardSellers[cardId] = seller
			}
		}
	}

	return coverage
}

func selectBestSeller(coverage map[string]*sellerCoverage, assigned map[string]struct{}) (string, int) {
	bestKey := ""
	bestCount := 0
	bestPrice := math.MaxFloat64

	for sellerKey, entry := range coverage {
		count := 0
		totalPrice := 0.0

		for cardId, seller := range entry.cardSellers {
			if _, exists := assigned[cardId]; exists {
				continue
			}

			count++
			totalPrice += seller.Price
		}

		if count == 0 {
			continue
		}

		if count > bestCount || (count == bestCount && totalPrice < bestPrice) {
			bestKey = sellerKey
			bestCount = count
			bestPrice = totalPrice
		}
	}

	if bestCount == 0 {
		return "", 0
	}

	return bestKey, bestCount
}

func sellerKey(listing models.Seller) string {
	name := strings.ToLower(strings.TrimSpace(listing.SellerName))
	country := strings.ToLower(strings.TrimSpace(listing.SellerCountry))

	if country == "" {
		return name
	}

	return fmt.Sprintf("%s|%s", name, country)
}

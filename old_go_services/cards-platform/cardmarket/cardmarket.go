package cardmarket

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/PuerkitoBio/goquery"
	"github.com/wailsapp/wails/v3/pkg/application"

	cardsplatform "dijkstra-cards/src/cards-platform"
	"dijkstra-cards/src/models"
)

const defaultBaseURL = "https://www.cardmarket.com/en/Magic/Products/Singles/"

type CardmarketService struct {
	app     *application.App
	client  *http.Client
	baseURL string

	cardSellers struct {
		sync.RWMutex
		entries map[string]*sellerCacheEntry
	}

	fetchStatus struct {
		sync.RWMutex
		entries map[string]*SellerFetchStatus
	}
}

type sellerCacheEntry struct {
	listings []models.Seller
	fetchErr error
	fetched  bool
}

type SellerFetchStatus struct {
	CardID         string `json:"cardId"`
	HadError       bool   `json:"hadError"`
	ErrorMessage   string `json:"errorMessage,omitempty"`
	SellersFound   bool   `json:"sellersFound"`
	FetchAttempted bool   `json:"fetchAttempted"`
}

func (s *CardmarketService) recordFetchStatus(status SellerFetchStatus) {
	s.fetchStatus.Lock()
	s.fetchStatus.entries[status.CardID] = &status
	s.fetchStatus.Unlock()
}

func NewCardmarketService(app *application.App, client *http.Client) *CardmarketService {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	service := &CardmarketService{
		app:     app,
		client:  client,
		baseURL: defaultBaseURL,
	}
	service.cardSellers.entries = make(map[string]*sellerCacheEntry)
	service.fetchStatus.entries = make(map[string]*SellerFetchStatus)

	return service
}

func (s *CardmarketService) getPageContents(url string, waitFor string) string {
	js := `
	try {
		return document.querySelector('body').innerHTML;
	} catch(error) {
		return error.toString();
	}
	`

	window := s.app.Window.NewWithOptions(application.WebviewWindowOptions{
		URL: url,
	})

	ch := make(chan string)

	clbk := func(result string) {
		log.Printf(">> CLBK: %s", result)
		ch <- result
	}

	result := ""
	window.ExecJSWithCallback(js, clbk)
	result = <-ch

	for !strings.Contains(result, waitFor) {
		time.Sleep(1 * time.Second)
		window.ExecJSWithCallback(js, clbk)
		result = <-ch
	}

	log.Printf(">>>>>> RESULT: %s", result)

	window.Close()

	return result
}

func (s *CardmarketService) Test() {
	s.getPageContents("http://localhost:8123", "div")
}

func (s *CardmarketService) GetCardSellers(ctx context.Context, query cardsplatform.CardQuery) ([]models.Seller, error) {
	key := query.Card.Id

	if cached, ok := s.GetCachedSellers(key); ok {
		return cached, nil
	}

	body, err := s.queryCardPage(ctx, query)
	if err != nil {
		log.Print(">>> ERROR, could not get card sellers html")
		s.storePrefetchedError(key, err)
		return nil, err
	}

	sellers, err := s.ParseSellerListings(body)
	if err != nil {
		log.Print(">>> ERROR, could not process card sellers html")
		s.storePrefetchedError(key, err)
		return nil, err
	}

	if len(sellers) == 0 {
		log.Printf(">>> ERROR, could not find any sellers for a card: %s", key)
		err := errors.New("Sellers not found: Empty list")
		s.storePrefetchedError(key, err)
		return nil, err
	}

	s.storePrefetchedSellers(key, sellers)

	return cloneSellerListings(sellers), nil
}

func (s *CardmarketService) GetCachedSellers(key string) ([]models.Seller, bool) {
	s.cardSellers.RLock()
	defer s.cardSellers.RUnlock()

	entry, ok := s.cardSellers.entries[key]
	if !ok {
		log.Printf(">>> Cached sellers for card.Id: '%s' not found", key)
		return nil, false
	}

	if entry.fetchErr != nil {
		log.Printf(">>> Card with id: '%s' had a fetching error", key)
		return nil, false
	}

	return cloneSellerListings(entry.listings), true
}

func (s *CardmarketService) storePrefetchedSellers(key string, listings []models.Seller) {
	s.cardSellers.Lock()
	log.Printf(">>> Storing card key: %s", key)
	s.cardSellers.entries[key] = &sellerCacheEntry{listings: cloneSellerListings(listings), fetched: true}
	s.cardSellers.Unlock()

	s.recordFetchStatus(SellerFetchStatus{
		CardID:         key,
		HadError:       false,
		ErrorMessage:   "",
		SellersFound:   len(listings) > 0,
		FetchAttempted: true,
	})
}

func (s *CardmarketService) storePrefetchedError(key string, err error) {
	s.cardSellers.Lock()
	s.cardSellers.entries[key] = &sellerCacheEntry{fetchErr: err, fetched: true}
	s.cardSellers.Unlock()

	s.recordFetchStatus(SellerFetchStatus{
		CardID:         key,
		HadError:       true,
		ErrorMessage:   errorMessage(err),
		SellersFound:   false,
		FetchAttempted: true,
	})
}

func (s *CardmarketService) GetFetchStatuses(cardIDs []string) []SellerFetchStatus {
	statuses := make([]SellerFetchStatus, 0, len(cardIDs))

	s.fetchStatus.RLock()
	defer s.fetchStatus.RUnlock()

	for _, id := range cardIDs {
		if status, ok := s.fetchStatus.entries[id]; ok {
			copy := *status
			statuses = append(statuses, copy)
			continue
		}

		statuses = append(statuses, SellerFetchStatus{
			CardID:         id,
			HadError:       false,
			ErrorMessage:   "",
			SellersFound:   false,
			FetchAttempted: false,
		})
	}

	return statuses
}

func errorMessage(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func cloneSellerListings(listings []models.Seller) []models.Seller {
	if len(listings) == 0 {
		return nil
	}

	copied := make([]models.Seller, len(listings))
	copy(copied, listings)
	return copied
}

func (s *CardmarketService) queryCardPage(ctx context.Context, query cardsplatform.CardQuery) (string, error) {
	log.Println(">>> Request card page start")
	if err := query.Validate(); err != nil {
		return "", err
	}

	targetURL, err := BuildSearchURL(query)
	if err != nil {
		return "", err
	}

	log.Printf(">>> URL: %s", targetURL)

	// req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	// if err != nil {
	// 	return "", fmt.Errorf("creating cardmarket request: %w", err)
	// }

	// ua := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
	// req.Header.Set("User-Agent", ua)
	// req.Header.Set("Host", "www.cardmarket.com")
	// req.Header.Set("DNT", "1")
	// req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	// req.Header.Set("Accept-Language", "en-US;q=0.7,en;q=0.3")
	// // TODO: Add gzip encoding support https://gist.github.com/the42/1956518
	// req.Header.Set("Connection", "keep-alive")

	content := s.getPageContents(targetURL, "The Gathering")

	// resp, err := s.client.Do(req)
	// if err != nil {
	// 	return "", fmt.Errorf("executing cardmarket request: %w", err)
	// }
	// defer resp.Body.Close()

	// if resp.StatusCode != http.StatusOK {
	// 	return "", fmt.Errorf("cardmarket request failed: %s", resp.Status)
	// }

	// body, err := io.ReadAll(resp.Body)
	// if err != nil {
	// 	return "", fmt.Errorf("reading cardmarket response: %w", err)
	// }

	// return string(body), nil

	return content, nil
}

// ParseSellerListings processes the HTML body of a Cardmarket page and extracts all seller rows.
func (s *CardmarketService) ParseSellerListings(body string) ([]models.Seller, error) {
	if strings.TrimSpace(body) == "" {
		return nil, fmt.Errorf("empty cardmarket body")
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("parsing cardmarket html: %w", err)
	}

	var listings []models.Seller

	doc.Find("div.article-table div.article-row").Each(func(_ int, row *goquery.Selection) {
		listing := models.Seller{
			SellerName:    extractSellerName(row),
			SellerCountry: extractSellerCountry(row),
			CardCondition: extractCardCondition(row),
			CardsAmmount:  extractCardsAmount(row),
		}

		if price, currency, err := extractPriceAndCurrency(row); err == nil {
			listing.Price = price
			listing.Currency = currency
		} else {
			log.Printf(">>> cardmarket: unable to parse price for seller %q: %v", listing.SellerName, err)
		}

		if listing.SellerName == "" && listing.Price == 0 && listing.CardsAmmount == 0 {
			return
		}

		listings = append(listings, listing)
	})

	return listings, nil
}

func extractSellerName(row *goquery.Selection) string {
	name := strings.TrimSpace(row.Find(".seller-name a").First().Text())
	if name == "" {
		name = strings.TrimSpace(row.Find(".seller-name").First().Text())
	}
	return name
}

func extractSellerCountry(row *goquery.Selection) string {
	if label, ok := row.Find(".seller-info .icon[aria-label^='Item location']").First().Attr("aria-label"); ok {
		return normalizeCountryLabel(label)
	}
	if label, ok := row.Find(".seller-info .icon[aria-label]").First().Attr("aria-label"); ok {
		return normalizeCountryLabel(label)
	}
	if tooltip, ok := row.Find(".seller-info .icon").First().Attr("data-bs-original-title"); ok {
		return normalizeCountryLabel(tooltip)
	}
	return ""
}

func normalizeCountryLabel(val string) string {
	val = strings.TrimSpace(strings.ReplaceAll(val, "Item location:", ""))
	if idx := strings.LastIndex(val, ":"); idx != -1 {
		val = strings.TrimSpace(val[idx+1:])
	}
	return val
}

func extractCardCondition(row *goquery.Selection) string {
	if condition := strings.TrimSpace(row.Find(".article-condition .badge").First().Text()); condition != "" {
		return condition
	}
	if tooltip, ok := row.Find(".article-condition").First().Attr("data-bs-original-title"); ok {
		return strings.TrimSpace(tooltip)
	}
	return ""
}

func extractCardsAmount(row *goquery.Selection) uint {
	amountText := strings.TrimSpace(row.Find(".amount-container .item-count").First().Text())
	if amountText == "" {
		return 0
	}
	amountText = strings.ReplaceAll(amountText, ".", "")
	amountText = strings.ReplaceAll(amountText, ",", "")

	value, err := strconv.ParseUint(amountText, 10, 32)
	if err != nil {
		return 0
	}
	return uint(value)
}

func extractPriceAndCurrency(row *goquery.Selection) (float64, string, error) {
	priceText := strings.TrimSpace(row.Find(".price-container .color-primary").First().Text())
	if priceText == "" {
		priceText = strings.TrimSpace(row.Find(".mobile-offer-container .color-primary").First().Text())
	}
	if priceText == "" {
		return 0, "", fmt.Errorf("price not found")
	}
	return parsePriceCurrency(priceText)
}

func parsePriceCurrency(raw string) (float64, string, error) {
	replacer := strings.NewReplacer("\u00a0", " ", "\u202f", " ")
	cleaned := strings.TrimSpace(replacer.Replace(raw))
	if cleaned == "" {
		return 0, "", fmt.Errorf("empty price string")
	}

	var numericBuilder strings.Builder
	var currencyBuilder strings.Builder

	for _, r := range cleaned {
		switch {
		case unicode.IsDigit(r) || r == ',' || r == '.':
			numericBuilder.WriteRune(r)
		case unicode.IsLetter(r) || unicode.IsSymbol(r):
			currencyBuilder.WriteRune(r)
		}
	}

	numeric := numericBuilder.String()
	if numeric == "" {
		return 0, strings.TrimSpace(currencyBuilder.String()), fmt.Errorf("price value not found in %q", raw)
	}

	normalized := normalizeDecimalString(numeric)
	value, err := strconv.ParseFloat(normalized, 64)
	if err != nil {
		return 0, strings.TrimSpace(currencyBuilder.String()), fmt.Errorf("parsing %q as price: %w", normalized, err)
	}

	currency := strings.TrimSpace(currencyBuilder.String())
	if currency == "" {
		parts := strings.Fields(cleaned)
		if len(parts) > 1 {
			currency = parts[len(parts)-1]
		}
	}

	return value, currency, nil
}

func normalizeDecimalString(number string) string {
	lastComma := strings.LastIndex(number, ",")
	lastDot := strings.LastIndex(number, ".")

	switch {
	case lastComma > lastDot:
		number = strings.ReplaceAll(number, ".", "")
		number = strings.ReplaceAll(number, ",", ".")
	case lastDot > lastComma:
		number = strings.ReplaceAll(number, ",", "")
	default:
		number = strings.ReplaceAll(number, ",", ".")
	}

	return number
}

func BuildSearchURL(query cardsplatform.CardQuery) (string, error) {
	u, err := url.Parse(defaultBaseURL)
	if err != nil {
		return "", fmt.Errorf("parsing base url: %w", err)
	}

	cardName := encodeParam(query.Card.CardName)
	editionName := encodeParam(query.Card.EditionName)

	log.Printf(">>> Query: card=%s, edition=%s", cardName, editionName)

	u = u.JoinPath(editionName, cardName)

	params := u.Query()

	u.RawQuery = params.Encode()
	return u.String(), nil
}

func BuildCardPageURL(card models.Card) (string, error) {
	u, err := url.Parse(defaultBaseURL)
	if err != nil {
		return "", fmt.Errorf("parsing base url: %w", err)
	}

	cardName := encodeParam(card.CardName)
	setName := encodeParam(card.EditionName)

	log.Printf(">>> Query: card=%s, set=%s", cardName, setName)

	u = u.JoinPath(setName, cardName)

	params := u.Query()

	u.RawQuery = params.Encode()
	return u.String(), nil
}

func encodeParam(param string) string {
	return url.QueryEscape(strings.ToLower(strings.Replace(param, " ", "-", -1)))
}

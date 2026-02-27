package cards

import (
	"dijkstra-cards/src/cards-platform/cardmarket"
	"dijkstra-cards/src/fileservice"
	"dijkstra-cards/src/models"
	"log"
	"strconv"

	"github.com/gocarina/gocsv"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type CardService struct {
	app   *application.App
	Cards []models.Card
}

func NewCardService(app *application.App) *CardService {
	return &CardService{
		app: app,
	}
}

func (s *CardService) GetCards() []models.Card { return s.Cards }

func (s *CardService) LoadCards() (bool, error) {

	log.Print(">>> Opening a file")

	fileData, err := fileservice.LoadFile(s.app)

	if err != nil {
		log.Print(">>> Failed to open a deck file")
		return false, err
	}

	if fileData == "" {
		log.Print(">>> Opening canceled")
		return false, nil
	}

	if err := gocsv.UnmarshalString(fileData, &s.Cards); err != nil {
		log.Print(">>> Could not parse CSV")
		return false, err
	}

	for i, card := range s.Cards {
		s.Cards[i].Id = strconv.Itoa(i)
		s.Cards[i].Link, _ = cardmarket.BuildCardPageURL(card)
	}

	return true, nil
}

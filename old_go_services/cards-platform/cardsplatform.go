package cardsplatform

import (
	"dijkstra-cards/src/models"

	"context"
	"errors"
	"strings"
)

// CardQuery describes the set of parameters that can be used when requesting
// data from an external cards marketplace. CardName is mandatory while the
// remaining fields are optional filters that will be applied by specific
// platform implementations when supported.
type CardQuery struct {
	Card                models.Card
	Language            string
	ShipmentDestination string
}

// Validate ensures the query contains the minimal data required to issue a
// request to an external platform.
func (q CardQuery) Validate() error {
	if strings.TrimSpace(q.Card.CardName) == "" {
		return errors.New("card name is required")
	}
	return nil
}

// Service describes the behaviour that every cards platform integration must
// implement.
type Service interface {
	// QueryCardPage retrieves the HTML contents of the platform page matching
	// the provided query.
	QueryCardPage(ctx context.Context, query CardQuery) (string, error)
}

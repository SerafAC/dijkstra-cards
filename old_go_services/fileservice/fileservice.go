package fileservice

import (
	"errors"
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func LoadFile(app *application.App) (string, error) {

	var selectedPath string

	if ofd := app.Dialog.OpenFile(); ofd != nil {
		res, _ := ofd.
			SetTitle("Select CSV file").
			AddFilter("CSV files", "*.csv").
			PromptForSingleSelection()

		switch v := any(res).(type) {
		case string:
			selectedPath = v
		case []string:
			if len(v) > 0 {
				selectedPath = v[0]
			}
		}
	} else {
		return "", errors.New("Failed to open a File Dialog")
	}

	// User cancelled dialog
	if selectedPath == "" {
		return "", nil
	}

	bytes, err := os.ReadFile(selectedPath)
	if err != nil {
		return "", errors.New("Failed to open deck file")
	}

	if len(bytes) == 0 {
		app.Dialog.Info().
			SetTitle("File Loader").
			SetMessage("The selected CSV file is empty.").
			Show()
		return "", nil
	}

	return string(bytes), nil
}

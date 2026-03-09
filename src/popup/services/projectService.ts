import type { Card, CardFilters, PersistedAssignment, PersistedError, PersistedSellersByCard, ProjectFile, Seller } from '../types/models'
import { CardService } from './cardService'
import { StorageService } from './storageService'
import { saveSelectedCards } from '../stores/selectedCards'
import {
  setProjectFileHandle,
  setProjectFileName,
  getProjectFileHandle,
  clearProject,
} from '../stores/projectStore'

function buildProjectData(
  selectedCards: Card[],
  filters: CardFilters | null,
  persistedAssignments: PersistedAssignment[],
  persistedErrors: PersistedError[],
  sellersByCard: Map<string, Seller[]>,
): ProjectFile {
  const csvContent = CardService.GetCsvContent()
  const deckFileName = CardService.GetDeckFileName()

  const persistedSellersByCard: PersistedSellersByCard[] = []
  for (const [cardId, sellers] of sellersByCard) {
    const card = selectedCards.find((c) => c.Id === cardId)
    if (card) {
      persistedSellersByCard.push({ cardName: card.CardName, editionName: card.EditionName, sellers })
    }
  }

  return {
    version: 1,
    deckFileName,
    csvContent,
    selectedCards: selectedCards.map((c) => ({
      cardName: c.CardName,
      editionName: c.EditionName,
    })),
    filters,
    assignments: persistedAssignments,
    errors: persistedErrors,
    sellersByCard: persistedSellersByCard,
  }
}

function supportsFileSystemAccess(): boolean {
  return typeof window.showSaveFilePicker === 'function'
}

async function writeToHandle(handle: FileSystemFileHandle, data: ProjectFile): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(JSON.stringify(data, null, 2))
  await writable.close()
}

function downloadAsFile(data: ProjectFile, fileName: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export const ProjectService = {
  /**
   * Save the current state to a new project file (Save As).
   * Returns true if saved successfully.
   */
  async saveAs(
    selectedCards: Card[],
    filters: CardFilters | null,
    persistedAssignments: PersistedAssignment[],
    persistedErrors: PersistedError[],
    sellersByCard: Map<string, Seller[]>,
  ): Promise<boolean> {
    const deckFileName = CardService.GetDeckFileName()
    const defaultName = deckFileName
      ? deckFileName.replace(/\.csv$/i, '') + '.dcproject.json'
      : 'project.dcproject.json'

    const data = buildProjectData(selectedCards, filters, persistedAssignments, persistedErrors, sellersByCard)

    if (supportsFileSystemAccess()) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [
            {
              description: 'Dijkstra Cards Project',
              accept: { 'application/json': ['.dcproject.json', '.json'] },
            },
          ],
        })
        await writeToHandle(handle, data)
        setProjectFileHandle(handle)
        return true
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          console.log('[ProjectService] Save cancelled by user')
          return false
        }
        console.error('[ProjectService] Failed to save project file:', err)
        throw err
      }
    } else {
      downloadAsFile(data, defaultName)
      setProjectFileName(defaultName)
      return true
    }
  },

  /**
   * Auto-save to the current project file handle.
   * Only works if we have a file handle from a previous save/open.
   */
  async autoSave(
    selectedCards: Card[],
    filters: CardFilters | null,
    persistedAssignments: PersistedAssignment[],
    persistedErrors: PersistedError[],
    sellersByCard: Map<string, Seller[]>,
  ): Promise<boolean> {
    const handle = getProjectFileHandle()
    if (!handle) return false

    const data = buildProjectData(selectedCards, filters, persistedAssignments, persistedErrors, sellersByCard)

    try {
      await writeToHandle(handle, data)
      return true
    } catch (err) {
      console.error('[ProjectService] Auto-save failed:', err)
      return false
    }
  },

  /**
   * Open a project file and restore all state.
   * Returns true if loaded successfully.
   */
  async open(): Promise<boolean> {
    if (supportsFileSystemAccess()) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'Dijkstra Cards Project',
              accept: { 'application/json': ['.dcproject.json', '.json'] },
            },
          ],
        })
        const file = await handle.getFile()
        const text = await file.text()
        const project = JSON.parse(text) as ProjectFile

        const success = await this.restoreProject(project)
        if (success) {
          setProjectFileHandle(handle)
          await StorageService.addRecentProject(file.name, text, project.selectedCards?.length ?? 0)
        }
        return success
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          console.log('[ProjectService] Open cancelled by user')
          return false
        }
        console.error('[ProjectService] Failed to open project file:', err)
        throw err
      }
    } else {
      return this.openViaFileInput()
    }
  },

  /**
   * Fallback open via standard file input (for Firefox etc.)
   */
  openViaFileInput(): Promise<boolean> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.dcproject.json,.json'

      input.addEventListener('change', async () => {
        const file = input.files?.[0]
        if (!file) {
          console.warn('[ProjectService] No file selected')
          resolve(false)
          return
        }
        try {
          const text = await file.text()
          const project = JSON.parse(text) as ProjectFile
          const success = await this.restoreProject(project)
          if (success) {
            setProjectFileName(file.name)
            await StorageService.addRecentProject(file.name, text, project.selectedCards?.length ?? 0)
          }
          resolve(success)
        } catch (err) {
          console.error('[ProjectService] Failed to read or parse project file:', err)
          resolve(false)
        }
      })

      input.addEventListener('cancel', () => resolve(false))
      input.click()
    })
  },

  /**
   * Restore state from a parsed project file.
   */
  async restoreProject(project: ProjectFile): Promise<boolean> {
    if (!project.version || !project.csvContent) {
      console.error('[ProjectService] Invalid project file: missing version or CSV content')
      return false
    }

    // Load deck from CSV content
    const loaded = await CardService.LoadFromRecent(project.csvContent, project.deckFileName)
    if (!loaded) {
      console.error('[ProjectService] Failed to load deck from project CSV:', project.deckFileName)
      return false
    }

    // Restore selected cards
    const allCards = await CardService.GetCards()
    if (project.selectedCards?.length) {
      const selectedSet = new Set(
        project.selectedCards.map(
          (s) => `${s.cardName.toLowerCase()}|${s.editionName.toLowerCase()}`,
        ),
      )
      const matched = allCards.filter((c) =>
        selectedSet.has(`${c.CardName.toLowerCase()}|${c.EditionName.toLowerCase()}`),
      )
      saveSelectedCards(matched.length > 0 ? matched : allCards)
    } else {
      saveSelectedCards(allCards)
    }

    // Persist assignments/errors/sellersByCard so SearchCardsPage restores them
    if (project.assignments?.length || project.errors?.length || project.sellersByCard?.length) {
      await StorageService.saveSearchResults({
        deckFileName: project.deckFileName,
        assignments: project.assignments ?? [],
        errors: project.errors ?? [],
        sellersByCard: project.sellersByCard ?? [],
      })
    }

    // Persist filters
    if (project.filters) {
      await StorageService.saveCardFilters(project.filters)
    }

    return true
  },

  clearProject() {
    clearProject()
  },
}

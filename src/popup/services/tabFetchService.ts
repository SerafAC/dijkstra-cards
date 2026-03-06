const INITIAL_LOAD_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 10 * 60 * 1_000 // 10 minutes
const FOCUS_TAB_ON_RETRY = 2 // focus the tab for the user after this many retries

function createTab(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError || tab.id == null) {
        reject(new Error(chrome.runtime.lastError?.message ?? 'Failed to open tab'))
        return
      }
      resolve(tab.id)
    })
  })
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated)
      reject(new Error(`Tab did not finish loading within ${INITIAL_LOAD_TIMEOUT_MS}ms`))
    }, INITIAL_LOAD_TIMEOUT_MS)

    const onUpdated = (id: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (id !== tabId || changeInfo.status !== 'complete') return
      clearTimeout(timeout)
      chrome.tabs.onUpdated.removeListener(onUpdated)
      resolve()
    }

    chrome.tabs.onUpdated.addListener(onUpdated)
  })
}

function navigateTab(tabId: number, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: (targetUrl: string) => { location.href = targetUrl },
        args: [url],
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve()
      },
    )
  })
}

function executeScript<T>(tabId: number, func: (...args: never[]) => T, args?: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      { target: { tabId }, func, args: args ?? [] },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve(results?.[0]?.result as T)
      },
    )
  })
}

function submitSearch(tabId: number, cardName: string): Promise<boolean> {
  return executeScript(tabId, (name: string) => {
    const input = document.querySelector('#ProductSearchInput') as HTMLInputElement | null
    if (!input) return false
    input.value = name
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const form = input.closest('form')
    if (form) {
      form.submit()
    } else {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
    }
    return true
  }, [cardName])
}

function checkIsCardPage(tabId: number): Promise<boolean> {
  return executeScript(tabId, () => {
    return document.querySelector('.article-row') !== null
  })
}

interface TabCardFilters {
  language?: number[]
  minCondition?: number | null
}

async function applyCardFilters(tabId: number, filters: TabCardFilters): Promise<void> {
  const urlStr = await executeScript(tabId, () => window.location.href)
  const url = new URL(urlStr)
  if (filters?.language) {
    url.searchParams.set('language', filters.language.join(','))
  }
  if (filters?.minCondition) {
    url.searchParams.set('minCondition', filters.minCondition.toString())
  }
  navigateTab(tabId, url.toString());
}

function clickEditionMatch(tabId: number, editionName: string): Promise<boolean> {
  return executeScript(tabId, (edition: string) => {
    const spans = document.querySelectorAll('span.expansion-symbol')
    if (spans.length === 0) return false

    const editionWords = edition.toLowerCase().split(/\s+/).filter(Boolean)
    if (editionWords.length === 0) return false

    let bestSpan: Element | null = null
    let bestCount = 0

    spans.forEach((span) => {
      const label = (span.getAttribute('aria-label') || '').toLowerCase()
      let matchCount = 0
      for (const word of editionWords) {
        if (label.includes(word)) matchCount++
      }
      if (matchCount > bestCount) {
        bestCount = matchCount
        bestSpan = span
      }
    })

    if (!bestSpan || bestCount === 0) return false

    const link = (bestSpan as Element).closest('a') || bestSpan
    ;(link as HTMLElement).click()
    return true
  }, [editionName])
}

function readTabHtml(tabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      { target: { tabId }, func: () => document.documentElement.outerHTML },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        const html = results?.[0]?.result
        if (typeof html !== 'string') {
          reject(new Error('Failed to extract HTML from tab'))
          return
        }
        resolve(html)
      },
    )
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pollUntilPredicate(
  tabId: number,
  predicate: (html: string) => boolean,
): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  let retryCount = 0

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    retryCount++

    if (retryCount === FOCUS_TAB_ON_RETRY) {
      chrome.tabs.update(tabId, { active: true })
    }

    const html = await readTabHtml(tabId)
    if (predicate(html)) {
      return html
    }
  }

  throw new Error(`Predicate not satisfied after ${POLL_TIMEOUT_MS / 60_000} minutes`)
}

/**
 * Opens a new background tab at the given root URL and waits for it to load.
 * Returns the tab ID for reuse with fetchViaTab.
 */
export async function openBrowsingTab(rootUrl: string): Promise<number> {
  const tabId = await createTab(rootUrl)
  await waitForTabLoad(tabId)
  return tabId
}

/**
 * Closes a tab previously opened with openBrowsingTab.
 */
export function closeBrowsingTab(tabId: number): void {
  chrome.tabs.remove(tabId)
}

/**
 * Navigates an existing tab to `url` by setting `location.href` (so the
 * Referer header points to the previous page on the same domain), waits for
 * the page to load, and returns the HTML.
 *
 * If `predicate` is provided the HTML must pass it before being returned.
 * On failure the tab is polled every 2s for up to 10 minutes. After the 2nd
 * retry the tab is focused so the user can intervene (e.g. solve a CAPTCHA).
 */
export async function fetchViaTab(
  tabId: number,
  url: string,
  predicate?: (html: string) => boolean,
): Promise<string> {
  await navigateTab(tabId, url)
  await waitForTabLoad(tabId)

  const html = await readTabHtml(tabId)
  if (!predicate || predicate(html)) {
    return html
  }

  return await pollUntilPredicate(tabId, predicate)
}

/**
 * Searches for a card by typing its name into the `#ProductSearchInput`
 * search bar, submitting the form, and handling the result page.
 *
 * If the result page contains `.article-row` elements it is a card page and
 * the HTML is returned directly.  Otherwise the function looks for
 * `span.expansion-symbol` elements and clicks the one whose `aria-label`
 * best matches `editionName`.  If no edition match is found the search is
 * treated as an error.
 *
 * The optional `predicate` works the same way as in `fetchViaTab`.
 */
export async function searchCardViaTab(
  tabId: number,
  cardName: string,
  editionName: string,
  filters?: TabCardFilters,
  predicate?: (html: string) => boolean,
): Promise<string> {

  if (predicate) await pollUntilPredicate(tabId, predicate)

  const submitted = await submitSearch(tabId, cardName)
  if (!submitted) {
    throw new Error('Search bar #ProductSearchInput not found on the page')
  }

  await waitForTabLoad(tabId)

  if (predicate) await pollUntilPredicate(tabId, predicate)

  // Check if we landed directly on a card page
  const isCardPage = await checkIsCardPage(tabId)
  if (isCardPage) {
    return await applyFiltersAndRead(tabId, filters, predicate)
  }

  if (predicate) await pollUntilPredicate(tabId, predicate)

  // Not a card page – try to find the right edition
  const matched = await clickEditionMatch(tabId, editionName)
  if (!matched) {
    throw new Error(`Search error: could not find edition "${editionName}" for card "${cardName}"`)
  }

  if (predicate) await pollUntilPredicate(tabId, predicate)

  await waitForTabLoad(tabId)

  return await applyFiltersAndRead(tabId, filters, predicate)
}

async function applyFiltersAndRead(
  tabId: number,
  filters?: TabCardFilters,
  predicate?: (html: string) => boolean,
): Promise<string> {
  const hasFilters = filters &&
    ((filters.language && filters.language.length > 0) || filters.minCondition != null)

  if (hasFilters) {
    await applyCardFilters(tabId, filters)
    await waitForTabLoad(tabId)
  }

  const html = await readTabHtml(tabId)
  if (!predicate || predicate(html)) {
    return html
  }
  return await pollUntilPredicate(tabId, predicate)
}

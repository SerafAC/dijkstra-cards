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

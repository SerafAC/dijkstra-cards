const INITIAL_LOAD_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 10 * 60 * 1_000 // 10 minutes
const FOCUS_TAB_ON_RETRY = 2 // focus the tab for the user after this many retries

function openTab(url: string): Promise<number> {
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
    if (predicate(html)) return html
  }

  throw new Error(`Predicate not satisfied after ${POLL_TIMEOUT_MS / 60_000} minutes`)
}

/**
 * Opens a URL in a background tab, waits for it to fully load, and returns
 * the page HTML.
 *
 * If `predicate` is provided the HTML must pass it before being returned.
 * On failure the tab is polled every ${POLL_INTERVAL_MS}ms for up to
 * ${POLL_TIMEOUT_MS / 60_000} minutes. After the ${FOCUS_TAB_ON_RETRY}nd
 * retry the tab is focused so the user can intervene (e.g. solve a CAPTCHA).
 *
 * Use this instead of fetch() to bypass CORS restrictions.
 */
export async function fetchViaTab(
  url: string,
  predicate?: (html: string) => boolean,
): Promise<string> {
  const tabId = await openTab(url)

  try {
    await waitForTabLoad(tabId)
    const html = await readTabHtml(tabId)

    if (!predicate || predicate(html)) {
      return html
    }

    return await pollUntilPredicate(tabId, predicate)
  } finally {
    chrome.tabs.remove(tabId)
  }
}

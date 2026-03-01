const TAB_FETCH_TIMEOUT_MS = 30_000

/**
 * Opens a URL in a background tab, waits for it to fully load,
 * extracts the page HTML via scripting injection, then closes the tab.
 * Use this instead of fetch() to bypass CORS restrictions.
 */
export async function fetchViaTab(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError || tab.id == null) {
        reject(new Error(chrome.runtime.lastError?.message ?? 'Failed to open tab'))
        return
      }

      const tabId = tab.id
      let settled = false

      const timeoutHandle = setTimeout(() => {
        if (settled) return
        settled = true
        chrome.tabs.onUpdated.removeListener(onUpdated)
        chrome.tabs.remove(tabId)
        reject(new Error(`Tab fetch timed out after ${TAB_FETCH_TIMEOUT_MS}ms`))
      }, TAB_FETCH_TIMEOUT_MS)

      const onUpdated = (
        updatedTabId: number,
        changeInfo: chrome.tabs.TabChangeInfo,
      ) => {
        if (updatedTabId !== tabId || changeInfo.status !== 'complete') return
        if (settled) return
        chrome.tabs.onUpdated.removeListener(onUpdated)

        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: () => document.documentElement.outerHTML,
          },
          (results) => {
            clearTimeout(timeoutHandle)
            if (settled) return
            settled = true

            chrome.tabs.remove(tabId)

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
      }

      chrome.tabs.onUpdated.addListener(onUpdated)
    })
  })
}

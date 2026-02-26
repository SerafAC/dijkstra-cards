/**
 * Background Service Worker
 *
 * This script runs as an MV3 service worker in Chrome and Firefox.
 * It is the extension's event-driven background process.
 *
 * For cross-browser compatibility with the `browser.*` Promise-based API,
 * consider adding `webextension-polyfill`:
 *   npm install webextension-polyfill
 *   import browser from 'webextension-polyfill'
 *
 * Without the polyfill, use `chrome.*` for Chromium-based browsers and
 * `browser.*` for Firefox (which natively supports Promises in MV3).
 */

// Log extension lifecycle events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.log('[Dijkstra Cards] Extension installed.')
  } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.log(`[Dijkstra Cards] Extension updated to v${chrome.runtime.getManifest().version}.`)
  }
})

// Open popup in a new window when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
  const popupUrl = chrome.runtime.getURL('src/popup/index.html')
  chrome.windows.create({
    url: popupUrl,
    type: 'popup',
    width: 800,
    height: 600,
  })
})

// Example: listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Dijkstra Cards] Message received:', message, 'from:', sender)

  if (message.type === 'ping') {
    sendResponse({ type: 'pong', timestamp: Date.now() })
    return true // keep message channel open for async response
  }
})

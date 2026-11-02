import type { FullscreenMessage } from 'src/injections/fullscreen'
import * as Settings from 'src/services/settings'
import * as Info from 'src/services/info'
import * as Logs from 'src/services/logs'

const SCRIPT_ID = 'fullscreen'
const SCRIPT_FILE = 'injections/fullscreen.js'

export function isSupported(): boolean {
  return Info.isChromium && typeof browser.sidePanel?.close === 'function'
}

export function setupListeners(ready: Promise<void>): void {
  if (!isSupported()) return

  browser.runtime.onMessage.addListener(
    (
      msg: FullscreenMessage | undefined,
      sender: browser.runtime.Sender,
      sendResponse: (hidden: boolean) => void
    ) => {
      if (typeof msg?.sideberyFullscreen !== 'boolean') return
      const windowId = sender.tab?.windowId
      if (windowId === undefined) return

      if (msg.sideberyFullscreen) {
        void hideSidebar(windowId, ready).then(sendResponse)
        return true
      }

      // Must run synchronously to keep the user gesture from the content script
      browser.sidePanel.open({ windowId }).catch(err => {
        Logs.warn('Fullscreen: Cannot reopen side panel:', err)
      })
    }
  )
}

async function hideSidebar(windowId: ID, ready: Promise<void>): Promise<boolean> {
  await ready
  if (!Settings.state.hideSidebarInFullscreen) return false
  return browser.sidePanel.close({ windowId }).then(
    () => true,
    () => false
  )
}

let updatingWatcher = Promise.resolve()
export function updateWatcher(): Promise<void> {
  updatingWatcher = updatingWatcher.then(syncWatcher).catch(err => {
    Logs.err('Fullscreen: Cannot update content script:', err)
  })
  return updatingWatcher
}

async function syncWatcher(): Promise<void> {
  if (!isSupported()) return

  const registered = await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] })
  const enabled = Settings.state.hideSidebarInFullscreen
  if (enabled === registered.length > 0) return

  if (!enabled) {
    await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] })
    return
  }

  await browser.scripting.registerContentScripts([
    { id: SCRIPT_ID, js: [SCRIPT_FILE], matches: ['<all_urls>'] },
  ])

  const tabs = await browser.tabs.query({})
  for (const tab of tabs) {
    browser.scripting
      .executeScript({ target: { tabId: tab.id }, files: [SCRIPT_FILE] })
      .catch(() => {
        // Restricted or unloaded tab
      })
  }
}

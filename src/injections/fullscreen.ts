export interface FullscreenMessage {
  sideberyFullscreen: boolean
}

function sendFullscreenState(fullscreen: boolean): Promise<boolean> {
  return browser.runtime
    .sendMessage<FullscreenMessage, boolean>({ sideberyFullscreen: fullscreen })
    .catch(() => false)
}

window.stopSideberyFullscreenWatcher?.()
const watcher = new AbortController()
window.stopSideberyFullscreenWatcher = () => watcher.abort()

let sidebarHidden = false
let activationWaiter: AbortController | undefined

function showSidebar() {
  activationWaiter?.abort()
  activationWaiter = undefined
  sidebarHidden = false
  void sendFullscreenState(false)
}

// Chromium only allows opening the side panel during user activation,
// and leaving fullscreen with Esc or F11 does not grant it.
function showSidebarOnActivation() {
  if (navigator.userActivation.isActive) return showSidebar()

  activationWaiter?.abort()
  activationWaiter = new AbortController()
  const opts = { capture: true, signal: AbortSignal.any([watcher.signal, activationWaiter.signal]) }
  window.addEventListener('pointerdown', showSidebar, opts)
  window.addEventListener('keydown', showSidebar, opts)
}

async function onFullscreenChange() {
  if (document.fullscreenElement) {
    activationWaiter?.abort()
    activationWaiter = undefined
    if (sidebarHidden) return
    sidebarHidden = await sendFullscreenState(true)
    if (!sidebarHidden || document.fullscreenElement) return
  }

  if (sidebarHidden) showSidebarOnActivation()
}

document.addEventListener('fullscreenchange', onFullscreenChange, { signal: watcher.signal })

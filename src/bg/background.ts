import * as E from 'src/enums'
import { NOID } from 'src/defaults'
import * as IPC from 'src/services/ipc'
import * as IPPC from 'src/services/ippc.addon'
import * as Logs from 'src/services/logs'
import * as Settings from 'src/services/settings.bg'
import * as Windows from 'src/services/windows.bg'
import * as Favicons from 'src/services/favicons.bg'
import * as Containers from 'src/services/containers.bg'
import * as Tabs from 'src/services/tabs.bg'
import * as Store from 'src/services/storage.bg'
import * as Permissions from 'src/services/permissions.bg'
import * as Snapshots from 'src/services/snapshots.bg'
import * as Sidebar from 'src/services/sidebar.bg'
import * as Info from 'src/services/info.bg'
import * as Menu from 'src/services/menu.bg'
import * as WebReq from 'src/services/web-req.bg'
import * as Sync from 'src/services/sync.bg'
import * as Omnibox from 'src/services/omnibox.bg'
import * as Styles from 'src/services/styles.bg'
import * as SidebarAction from 'src/services/sidebar-action'
import * as WindowsApi from 'src/services/windows-api'
export default defineBackground(() => {
  markLocalStorage()

  Info.setInstanceType(E.InstanceType.bg)
  IPC.setInstanceType(E.InstanceType.bg)
  IPPC.setInstanceType(E.InstanceType.bg)
  Logs.setInstanceType(E.InstanceType.bg)

  const ts = performance.now()
  Logs.info('Init start')

  IPC.registerActions({
    cacheTabsData: Tabs.cacheTabsData,
    getGroupPageInitData: Tabs.getGroupPageInitData,
    getPlaceholderPageInitData: Tabs.getPlaceholderPageInitData,
    tabsApiProxy: Tabs.tabsApiProxy,
    getSidebarTabs: Tabs.getSidebarTabs,
    detachSidebarTabs: Tabs.detachSidebarTabs,
    openTabs: Tabs.openTabs,
    setActivePanelId: Sidebar.setActivePanelId,
    createSnapshot: Snapshots.createSnapshot,
    addSnapshot: Snapshots.addSnapshot,
    removeSnapshot: Snapshots.removeSnapshot,
    openSnapshotWindows: Snapshots.openWindows,
    createWindowWithTabs: Windows.createWithTabs,
    isWindowTabsLocked: Windows.isWindowTabsLocked,
    saveFavicon: Favicons.saveFavicon,
    reloadFavicons: Favicons.load,
    saveInLocalStorage: Store.setFromRemoteFg,
    checkIpInfo: WebReq.checkIpInfo,
    disableAutoReopening: WebReq.disableAutoReopening,
    enableAutoReopening: WebReq.enableAutoReopening,

    saveToSync: Sync.save,
    saveTabsToSync: Sync.saveTabs,
    saveProfileInfoToGoogleSync: Sync.Google.saveProfileInfo,
    removeFromSync: Sync.remove,
    removeFromFirefoxSync: Sync.Firefox.remove,
    removeByTypeFromSync: Sync.removeByType,
    removeCachedIdFromGoogleSync: Sync.Google.removeCachedId,
    getDataFromSync: Sync.getData,
    loadSync: Sync.load,

    getContainers: Containers.getContainers,
    setContainers: Containers.setContainers,
    createContainer: Containers.createAndSave,
    removeContainer: Containers.removeAndSave,
    importContainers: Containers.importContainers,
  })

  IPC.setupGlobalMessageListener()
  IPC.setupConnectionListener()
  Info.saveVersion()
  Windows.setupWindowsListeners()
  Settings.setupSettingsChangeListener()
  Sidebar.setupListeners()
  WebReq.updateReqHandlers()
  Tabs.setupListeners()
  Permissions.load()
  Permissions.setupListeners()
  Favicons.load()
  Menu.setupListeners()

  IPC.onConnected(E.InstanceType.sidebar, winId => {
    Logs.info('IPC.onConnected sidebar', winId)

    const tabs = Windows.byId.get(winId)?.tabs
    if (tabs) Tabs.initInternalPageScripts(tabs)

    if (Settings.state.markWindow && winId !== NOID) {
      IPC.sendToSidebar(winId, 'updWindowPreface')
    }
  })
  IPC.onDisconnected(E.InstanceType.sidebar, winId => {
    Logs.info('IPC.onDisconnected sidebar', winId)

    if (Settings.state.markWindow && Windows.byId.has(winId)) {
      WindowsApi.update(winId, { titlePreface: '' })
    }
  })

  initToolbarButton()
  Styles.load()
  Styles.setupListeners()

  browser.runtime.onUpdateAvailable.addListener(details => {
    const currentVersion = Info.versionToInt(browser.runtime.getManifest().version)
    const newVersion = Info.versionToInt(details.version)
    if (newVersion <= currentVersion) browser.runtime.reload()
  })

  Omnibox.setupListeners()
  Omnibox.load()

  const initialized = (async function main() {
    await Promise.all([
      Windows.load(),
      Containers.load(),
      Settings.load(),
      Info.loadVersionInfo(),
      Info.loadFileSchemeAccess(),
    ])
    await Sidebar.load()
    await Tabs.load()
    await Snapshots.scheduleSnapshots(true)

    Logs.info(`Init end: ${performance.now() - ts}ms`)

    if (typeof window === 'undefined') return
    window.getSideberyState = () => {
      return {
        profileId: Info.getProfileId(),
        Windows: {
          byId: Windows.byId,
        },
        Tabs: {
          byId: Tabs.byId,
          cacheByWin: Tabs.cacheByWin,
        },
      }
    }
  })()

  Snapshots.setupListeners(initialized)

  function initToolbarButton(): void {
    void Menu.createBrowserActionMenu()

    if (Info.isChromium && browser.sidePanel?.setPanelBehavior) {
      browser.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch(err => Logs.err('Cannot configure side panel action:', err))
      return
    }

    browser.action.onClicked.addListener((tab, info): void => {
      if (info && info.button === 1) browser.runtime.openOptionsPage()
      else SidebarAction.toggle(tab.windowId)
    })
  }

  function markLocalStorage() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem('sdbr', '+')
  }
})

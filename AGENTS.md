# Upstream merge notes

This fork adds Chromium support to upstream Sidebery v5. Keep Firefox behavior unchanged unless a browser-specific implementation is required.

The product branding is Sidechery. Preserve `sidebery` only for upstream references and compatibility-sensitive internal paths, globals, storage keys, and extension identity.

## Intentional divergences

- WXT owns build, dev, zip, entrypoint discovery, manifest generation, SVG inlining, locale generation, and per-browser output. See `wxt.config.ts` and `wxt/`.
- Vue uses `@vitejs/plugin-vue` directly. Do not restore `@wxt-dev/module-vue`; its global Vue auto-import preset pulls the DOM-dependent Vue dev runtime into Chromium's background worker.
- The manifest source is `wxt/manifest.json`. Do not restore `src/manifest.json` or the deleted `build/` pipeline.
- HTML entrypoints reference source `.ts` and `.styl` files. WXT preserves upstream output paths such as `sidebar/sidebar.html`, `sidebery/group.html`, and `styles/sidebar.css`.
- `src/dict.ts` resolves translations lazily because Vite may evaluate the shared dictionary module before page-specific dictionary side effects in production bundles. Do not restore eager `window.translations` snapshotting.
- `transform-vue-template-typescript` in `wxt.config.ts` strips TypeScript assertions left in Pug template modules during dev. Keep it while templates contain expressions such as `value as Type`.
- Chromium manifest generation removes Firefox-only permissions/action fields and normalizes command shortcuts. Firefox keeps the upstream manifest capabilities.
- Chromium maps Firefox's `_execute_sidebar_action` command to `_execute_action`; `src/services/keybindings.fg.ts` translates it back internally so upstream keybinding UI, exports, and sync names stay unchanged. Chromium commands are read-only, so keybinding editing, reset, and import remain Firefox-only; the setup page opens `chrome://extensions/shortcuts` through `tabs.create` because privileged URLs are not directly linkable.
- `src/services/styles.fg.ts` and `src/services/styles.bg.ts` use `browser.theme` only when available. Chromium maps Firefox-theme mode to system light/dark mode.
- `src/services/session-values.ts` is the compatibility boundary for Firefox-only tab/window session values. Firefox uses `browser.sessions`; Chromium uses `browser.storage.session`. Route new `getTabValue`, `setTabValue`, `getWindowValue`, and `setWindowValue` calls through it.
- `src/services/tabs-events.ts` registers filtered `tabs.onUpdated` listeners on Firefox and unfiltered listeners on Chromium, which rejects event filters. Route new filtered tab-update listeners through it.
- Chromium adds `webNavigation`; `src/services/tabs.fg.handlers.ts` uses its top-level lifecycle to distinguish document loads from `history.pushState` and fragment navigation. Only real document navigation may set a tab to loading.
- Chromium starts the spinner at top-level `onBeforeNavigate` for existing pages as well as blank tabs; `tabs.onUpdated` can delay its loading event until the response arrives. Failed document navigation clears the loading state even when the previous page had a committed URL.
- Chromium `webNavigation.onBeforeNavigate` supplies the pending URL for new tabs whose creation event has no URL/title. Render it immediately; form submissions may not emit a tab URL update until the response arrives. Keep the committed URL unchanged and clear the pending URL from the native snapshot on URL updates.
- Chromium tab updates reconcile titles from the native tab snapshot when `changeInfo` omits the title. Untitled Chromium rows display the committed URL or, before commit, `pendingUrl`, without changing the stored title. New tabs may initially have empty titles and URLs; never request `/_favicon/` for an empty URL or retry a failed favicon from its error handler.
- Chromium configures `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` instead of handling action clicks itself. This lets toolbar clicks and the `_execute_action` shortcut use Chrome's native open/close toggle.
- `SetupPage.copyDevtoolsUrl` copies Firefox's direct toolbox URL on Firefox and the current extension's `chrome://extensions` details page on Chromium, where live views can be inspected.
- Favicon backup import preserves the five storage shards used by `src/services/favicons.bg.ts`, deduplicates without adding a second copy, and skips only new icons after the cache reaches its limit.
- `src/services/tabs-api.ts` is the required boundary for all tab creation. It strips Firefox-only fields (`cookieStoreId`, `discarded`, `openInReaderMode`, `title`) and self-opener updates on Chromium. Firefox-only succession/warmup calls become no-ops there.
- Route tab discarding through `TabsApi.discard`; Firefox accepts arrays while Chromium requires one `tabs.discard` call per tab ID.
- Route tab duplication through `TabsApi.duplicate`; Chromium accepts only the tab ID and activates the copy, so background duplication restores the previous active tab. Chromium creation placement records use the native insertion index (next to the source) separately from the target sidebar index, preserving copied trees while the existing move queue sorts native tabs. Firefox keeps native duplication options.
- Foreground and background tab models migrate IDs in place on `tabs.onReplaced`, which Chromium can emit when prerendered/instant content swaps IDs. Do not replace this with full tab reinitialization; it visibly reloads the sidebar. The forced beforeunload discard retry remains Firefox-only.
- Chromium session restore detection matches recently removed tabs by URL, title, and native index because Firefox tab session values do not transfer to Chrome's new restored tab ID. Preserve `RemovedTabInfo.url` for tree restoration.
- Chromium restart cache matching uses `Tab.pendingUrl` and `Utils.restoreUrl` so lazy-restored tabs and regenerated internal-page IPC suffixes still match persisted tree data.
- Chromium tree restoration uses saved parent IDs only. Do not infer restored nesting from native `openerTabId`: it retains historical opener relationships after tabs have been flattened. Firefox keeps the upstream opener fallback.
- Tab rows use `Tab.renderId` as a stable Vue key across native ID replacement, avoiding remove/add animations during Chromium discard.
- Route window creation/update through `src/services/windows-api.ts`; Chromium strips Firefox-only `allowScriptsToClose`, `cookieStoreId`, and `titlePreface` fields.
- Tab screenshots route through `TabsApi.capture`: Firefox uses `captureTab`; Chromium uses `captureVisibleTab` only for an active target and returns no image for inactive tabs. Preview metadata still renders when Chromium cannot capture an image.
- `Utils.sanitizeUrl` replaces only `javascript:`, `jar:file:`, and inaccessible `file:` URLs with the placeholder page on Chromium. `file:` is opened when `Info.isFileSchemeAccessAllowed` (cached at startup; Chromium reloads the extension when the toggle changes), and the placeholder then explains the "Allow access to file URLs" toggle. Firefox keeps the upstream placeholder list.
- Chromium hides OS file paths from drag data. Files-only drops onto tab targets skip `preventDefault` so Chrome opens a native `file://` tab; `Tabs.takeDroppedFileTabPosition` moves that tab to the drop position. Other targets and Firefox keep the upstream blob fallback.
- `history.onTitleChanged` is Firefox-only and remains optional in `src/services/history.fg.ts`; Chromium updates history titles on normal reload paths.
- `src/services/sidebar-action.ts` owns Firefox sidebar-action vs Chromium Side Panel behavior. Chromium cannot set the native side-panel title.
- `src/services/info.ts` uses `runtime.getBrowserInfo` on Firefox and derives Chromium version metadata from the user agent. Keep Firefox-version gates disabled outside Firefox and route new browser-info reads through `Info.loadBrowserInfo`.
- Use `Info.isFirefox`/`Info.isChromium` for browser-family branches. Keep direct API feature detection only for capabilities that can vary by browser version or permission.
- `src/services/permissions.ts` filters Firefox-only permission names before calling the permissions API. Route new permission checks/requests through it; Chrome rejects unknown names such as `tabHide` and `webRequestBlocking`.
- `src/services/containers.ts` owns contextual-identity capability detection. Chromium disables native container loading/listeners, and tab normalization supplies `DEFAULT_CONTAINER_ID` when `cookieStoreId` is absent.
- The setup page hides its Containers section and navigation entry when `Containers.isSupported()` is false; direct container-section hashes fall back to General.
- Container-dependent request interception and per-container proxy handlers are disabled when contextual identities are unavailable.
- Context-menu code uses the shared `browser.contextMenus` namespace. Route creation through `src/services/context-menu.ts`, which removes Firefox-only creation fields on Chromium. Firefox-only `onHidden` and `overrideContext` calls remain optional. Chromium cannot replace the page context menu, so `ctxMenuNative` is forced off there in `Settings.updPrecalcSettings` and hidden on the setup page.
- Browser-action context menus are rebuilt only after `contextMenus.removeAll` completes because Chromium preserves menu items across service-worker restarts and rejects duplicate IDs.
- Shared style/favicon/settings helpers and `src/bg/background.ts` guard DOM globals so Chromium's service worker can initialize. Background favicon resizing is skipped without DOM canvas support. Do not add unguarded `window`, `document`, `Image`, or `localStorage` access to background imports/startup.
- Chromium uses the `favicon` permission and `/_favicon/` endpoint for missing or inaccessible native page icons. Live and recently closed Chrome-owned icons are marked with `data-native-favicon` and rendered as `currentColor` masks; `chrome-extension://` page icons retain their colors. Firefox retains upstream favicon handling.
- `BkmNode` infers Chromium bookmark node kinds from `url` because Chrome omits Firefox's `type`; an explicit `separator` remains a Firefox separator and other URL-less nodes are folders.
- Route bookmark creation through `src/services/bookmarks-api.ts`; Chromium strips Firefox's `type` and omits `url` for folders. Separator creation is hidden on Chromium and separators are skipped during save/undo; Firefox retains native separators.
- Internal group, placeholder, setup, and profile detection uses `browser.runtime.getURL`/parsed hosts. Never restore fixed Firefox UUID offsets; Chromium extension URL prefixes and IDs have different lengths.
- Internal-page IPC always uses BroadcastChannel on Chromium. Firefox keeps the `localStorage` marker to choose BroadcastChannel for the default container and hash messaging for isolated containers.
- Chromium manifest/action icons use supersampled raster `src/assets/logo-{16,20,24,32,40,48,64,128}.png` generated from `logo.svg`; the intermediate sizes cover fractional and HiDPI toolbar scale factors. Chrome falls back to a puzzle icon for SVG manifest icons. Regenerate every PNG when the source logo changes.
- Media injections are passed as functions from `src/injections/` instead of emitted standalone scripts. This keeps `browser.scripting.executeScript` compatible with WXT output.
- Background initialization is wrapped in `defineBackground`; listeners must remain synchronously registered inside that callback.
- Automatic snapshots are scheduled after settings and tabs load. Chromium uses a named repeating `alarms` event registered synchronously; preserve its deadline across worker starts and wait for initialization before taking a snapshot. Without a connected sidebar, Chromium reads saved tree metadata through `session-values`. Firefox retains its timer and upstream tree handling. Chromium snapshot auto-export uses data URLs because service workers cannot create blob URLs; export failures must not prevent local snapshot storage.
- Vite module preloading is disabled because Chromium extension pages reject generated chunk preloads as cross-world resource mismatches; normal ESM imports still load the chunks.
- pnpm is the package manager. Keep `pnpm-lock.yaml`; do not restore `package-lock.json`.

## Known Chromium gaps

These are not handled by the build migration yet:

- Remaining `browser.sidebarAction.isOpen` call sites need an equivalent Chromium open-state source.
- Container controls outside the main settings section still need to be hidden on Chromium; native contextual identities remain unavailable there.
- `menus.overrideContext` remains Firefox-only and needs guards at call sites.
- `browser.pageAction`, `tabs.hide/show`, window `titlePreface`, and Firefox proxy behavior need guards or alternatives.
- Chromium has no tab succession API (`successorTabId`/`moveInSuccession`), so native closes (Cmd+W, tab strip) and sidebar closes use Chrome's own next-tab choice. The "activate after closing" settings are hidden on the Chromium setup page; stored values still affect discard and `nativeHighlight` removal paths.
- The Chromium background service worker still contains timer and in-memory lifetime assumptions.

When merging upstream, preserve these boundaries, route new Firefox-only calls through the relevant compatibility layer, and update this file when another divergence is introduced.

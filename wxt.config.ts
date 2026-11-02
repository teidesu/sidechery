import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type EntrypointInfo } from 'wxt'
import { transformWithOxc } from 'vite'
import vue from '@vitejs/plugin-vue'

const sourceManifest = JSON.parse(fs.readFileSync('wxt/manifest.json', 'utf8'))
const svgInjectRe = /<inject>svg:\/\/(.+?)(#(.+))?<\/inject>/g

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: '../wxt/entrypoints',
  zip: {
    excludeSources: ['addon/**', 'build/**', 'coverage/**', 'dist/**'],
  },
  manifest: ({ browser }) => {
    const manifest = structuredClone(sourceManifest)
    delete manifest.manifest_version
    delete manifest.background
    delete manifest.options_ui
    delete manifest.sidebar_action

    if (browser !== 'firefox') {
      delete manifest.browser_specific_settings
      delete manifest.page_action
      manifest.permissions = manifest.permissions.filter(
        (permission: string) =>
          ![
            'contextualIdentities',
            'menus',
            'menus.overrideContext',
            'publicSuffix',
            'theme',
          ].includes(permission)
      )
      manifest.permissions.push('contextMenus')
      manifest.permissions.push('favicon')
      manifest.permissions.push('webNavigation')
      manifest.permissions.push('alarms')
      manifest.optional_permissions = manifest.optional_permissions.filter(
        (permission: string) => !['proxy', 'tabHide', 'webRequestBlocking'].includes(permission)
      )
      manifest.permissions.push('proxy')
      // Pin the extension ID so installs from different paths update the
      // existing installation instead of adding a separate extension.
      manifest.key =
        'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxYmjjo0xLPVOre3re6fs+//IhFgeGOw0GZ3O1s8QyqM4VpSyEIH1RucHt15ZMK4g15kMSOkG42R2XET8RRbUmWi8AlgAWyVnLXYjAVyxrRA4HlyqdTgTmeq0uZZ7X8q0htwurhCdsxL/Yj6fkbltQOiIGfKwptz7Z8HMLKfZ7bnhN4GAvr8tC2PqB7CncpQQhuuZsMTg7wzZoj4wQsOVMpIoJhOuqV4fHvTdVSs5kwhtlP9uibb1Vg4/t7sS66IhBgSPIUxqwSArxOnw7onm2NRBX9ELaxpzLoHz/l3lp3qi8cngEE8j4Ljt/b6X3261jCwNhKoNo1Q7NVDwyOYNrwIDAQAB'
      manifest.icons = {
        16: 'assets/logo-16.png',
        20: 'assets/logo-20.png',
        24: 'assets/logo-24.png',
        32: 'assets/logo-32.png',
        40: 'assets/logo-40.png',
        48: 'assets/logo-48.png',
        64: 'assets/logo-64.png',
        128: 'assets/logo-128.png',
      }
      manifest.action.default_icon = {
        16: 'assets/logo-16.png',
        20: 'assets/logo-20.png',
        24: 'assets/logo-24.png',
        32: 'assets/logo-32.png',
        40: 'assets/logo-40.png',
        48: 'assets/logo-48.png',
        64: 'assets/logo-64.png',
      }
      delete manifest.action.default_area
      delete manifest.action.theme_icons

      manifest.commands._execute_action = manifest.commands._execute_sidebar_action
      delete manifest.commands._execute_sidebar_action

      for (const [name, command] of Object.entries(
        manifest.commands as Record<string, { suggested_key?: Record<string, string> }>
      )) {
        if (name === '_execute_action' && command.suggested_key?.default) {
          command.suggested_key.windows = command.suggested_key.default
        } else {
          delete command.suggested_key
        }
      }
    }

    return manifest
  },
  hooks: {
    'entrypoints:found'(_, entrypoints) {
      const addEntrypoint = (
        name: string,
        type: EntrypointInfo['type'],
        inputPath: string
      ): void => {
        entrypoints.push({ name, type, inputPath: path.resolve(inputPath) })
      }

      addEntrypoint('background', 'background', 'src/bg/background.ts')
      addEntrypoint('sidepanel', 'sidepanel', 'src/sidebar/sidebar.html')
      addEntrypoint('options', 'options', 'src/page.setup/setup.html')
      addEntrypoint('group', 'unlisted-page', 'src/page.group/group.html')
      addEntrypoint('url', 'unlisted-page', 'src/page.url/url.html')
      addEntrypoint('editing', 'unlisted-page', 'src/popup.editing/editing.html')
      addEntrypoint('panel-config', 'unlisted-page', 'src/popup.panel-config/panel-config.html')
      addEntrypoint('proxy', 'unlisted-page', 'src/popup.proxy/proxy.html')
      addEntrypoint('search', 'unlisted-page', 'src/popup.search/search.html')
      addEntrypoint('sync', 'unlisted-page', 'src/popup.sync/sync.html')
    },
    'entrypoints:resolved'(wxt, entrypoints) {
      const outputDirs: Record<string, string> = {
        background: 'bg',
        editing: 'popup.editing',
        group: 'sidebery',
        options: 'page.setup',
        'panel-config': 'popup.panel-config',
        proxy: 'popup.proxy',
        search: 'popup.search',
        sidepanel: 'sidebar',
        sync: 'popup.sync',
        'tab-preview': 'injections',
        fullscreen: 'injections',
        url: 'sidebery',
      }
      for (const entrypoint of entrypoints) {
        const outputDir = outputDirs[entrypoint.name]
        if (outputDir) entrypoint.outputDir = path.resolve(wxt.config.outDir, outputDir)
        if (entrypoint.name === 'sidepanel') entrypoint.name = 'sidebar'
        else if (entrypoint.name === 'options') entrypoint.name = 'setup'
      }
    },
    'build:manifestGenerated'(wxt, manifest) {
      if (wxt.config.browser === 'firefox') {
        manifest.sidebar_action = {
          default_icon: 'assets/logo-native.svg',
          default_title: 'Sidechery',
          default_panel: 'sidebar/sidebar.html',
        }
      }
      if (manifest.options_ui) manifest.options_ui.open_in_tab = true
    },
    'build:publicAssets'(_, files) {
      for (const name of [
        'group-page-favicon.svg',
        'logo-16.png',
        'logo-20.png',
        'logo-24.png',
        'logo-32.png',
        'logo-40.png',
        'logo-48.png',
        'logo-64.png',
        'logo-128.png',
        'logo-native-dark.svg',
        'logo-native-light.svg',
        'logo-native.svg',
        'logo.svg',
        'proxy-native.svg',
        'snapshot-native.svg',
        'window-native.svg',
      ]) {
        files.push({
          absoluteSrc: path.resolve('src/assets', name),
          relativeDest: `assets/${name}`,
        })
      }

      const source = JSON.parse(fs.readFileSync('src/_locales/dict.browser.json', 'utf8'))
      const locales: Record<string, Record<string, { message: string }>> = {}
      for (const [key, translations] of Object.entries(source)) {
        for (const [locale, message] of Object.entries(translations as Record<string, string>)) {
          ;(locales[locale] ??= {})[key] = { message }
        }
      }
      for (const [locale, messages] of Object.entries(locales)) {
        files.push({
          contents: JSON.stringify(messages),
          relativeDest: `_locales/${locale}/messages.json`,
        })
      }
    },
    'vite:build:extendConfig'(_, config) {
      const output = config.build?.rollupOptions?.output
      if (output && !Array.isArray(output)) output.assetFileNames = 'styles/[name].[ext]'
    },
  },
  vite: ({ browser }) => ({
    resolve: { alias: { src: path.resolve('src') } },
    plugins: [
      vue(),
      {
        name: 'inline-sidebery-svg',
        enforce: 'pre',
        async transformIndexHtml(html) {
          const replacements = await Promise.all(
            Array.from(html.matchAll(svgInjectRe), async match => {
              const svgPath = match[1]
              if (!svgPath) return [match[0], match[0]] as const
              let svg = await fs.promises.readFile(path.resolve(svgPath), 'utf8')
              const id = match[3]
              if (id) {
                if (/<svg([^<]*?)id="([^<]*?)"/.test(svg)) {
                  svg = svg.replace(/<svg([^<]*?)id="([^<]*?)"/, (_, attrs) => {
                    return `<svg${attrs}id="${id}"`
                  })
                } else {
                  svg = svg.replace('<svg ', `<svg id="${id}" `)
                }
              }
              return [match[0], svg] as const
            })
          )
          return replacements.reduce(
            (result, [source, svg]) => result.replaceAll(source, svg),
            html
          )
        },
      },
      {
        name: 'transform-vue-template-typescript',
        enforce: 'post',
        transform(code, id) {
          if (!id.includes('?vue&type=template')) return
          return transformWithOxc(code, id, { lang: 'ts', sourcemap: true })
        },
      },
    ],
    build: {
      cssMinify: 'esbuild',
      ...(browser !== 'firefox' && { modulePreload: false }),
    },
  }),
})

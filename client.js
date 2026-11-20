/**
 * Plugin settings hub — browser half.
 *
 * The Settings navigation and one row per settings page are owned by the
 * platform: there is no slot API to unregister another package's
 * `settings.section` entry, and a section's component can only be rendered by
 * the shell that declared the slot. This bundle therefore groups the pages the
 * supported way plus a narrow DOM contract:
 *
 *  - It contributes a `settings.plugins.tab` page ("插件设置") that lists every
 *    folded plugin settings page as a card. Clicking a card selects that
 *    plugin's navigation row, which shows the plugin's own page — the content
 *    still belongs to the plugin, so nothing is reimplemented here.
 *  - It hides the folded plugin rows from the Settings navigation, so the
 *    Plugins page stays the single entry point. A page that already has a tab
 *    inside the Plugins page (the market) is hidden without a card.
 *  - It contributes a `settings.action` back control that appears while a
 *    folded plugin page is open and returns to the Plugins page.
 *
 * The navigation-row contract is the one the platform renders (a `<button>`
 * inside the settings panel's `<nav>`, with the row text as its label and
 * `aria-current` on the active row); the bundle only reads labels and dispatches
 * clicks, never another plugin's content. Styles use `--dsw-alias-*` theme
 * tokens and the plugin imports no Harness Client package.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-settings-hub',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useState } = React

    /** Locale namespace owned by this plugin. */
    const NS = 'plugin-settings-hub'

    /* ------------------------------------------------------------------ *
     * Dictionaries
     * ------------------------------------------------------------------ */

    const zh = {
      'tab': '插件设置',
      'intro': '这些插件的设置页集中在这里，左侧导航不再单独显示它们。点一个插件，直接打开它的设置页；打开后点头部的「返回插件设置」就能回来。',
      'empty': '没有找到带设置页的插件。其它插件的设置页仍可从左侧导航打开。',
      'back': '返回插件设置',
      'open': '打开设置',
      'biliWhale.description': '按作息刷 B 站、看视频、写日记，值得的内容 @ 你。',
      'qqbot.description': '在 QQ 私聊和群聊里直接对话 DeepSeek Harness。',
      'ourFreeModel.description': '免密接入免费模型，带 Token 用量看板与 OpenAI 兼容转发。',
    }

    const en = {
      'tab': 'Plugin settings',
      'intro': 'These plugins keep their settings pages here instead of the sidebar navigation. Open a plugin to jump to its settings; use Back to plugin settings in the header to return.',
      'empty': 'No plugin with a settings page yet. Settings pages of other plugins stay in the sidebar navigation.',
      'back': 'Back to plugin settings',
      'open': 'Open settings',
      'biliWhale.description': 'Browses Bilibili on a daily rhythm, reads videos and keeps journals, pinging you only for what matters.',
      'qqbot.description': 'Chats with DeepSeek Harness directly in QQ private and group chats.',
      'ourFreeModel.description': 'Free keyless model access with a token usage dashboard and an OpenAI-compatible forwarder.',
    }

    /* ------------------------------------------------------------------ *
     * Page tables
     * ------------------------------------------------------------------ */

    /**
     * Folded plugin pages that get a hub card, in display order. `labels` are
     * the navigation-row texts these plugins render.
     */
    const CARD_PAGES = [
      { key: 'bili-whale', labels: ['养鱼'], description: 'biliWhale.description' },
      { key: 'qqbot', labels: ['QQ 机器人', 'QQ机器人', 'QQ Bot', 'QQ bot'], description: 'qqbot.description' },
      { key: 'our-free-model', labels: ['Our Free Model', '免费模型'], description: 'ourFreeModel.description' },
    ]

    /**
     * Folded pages without a hub card: the plugin market already owns a tab in
     * the Plugins page, so only its separate navigation row is removed.
     */
    const TAB_PAGES = [
      { key: 'market', labels: ['插件市场', 'Plugin Market', 'プラグインマーケット', 'Market'] },
    ]

    /** Every page this bundle removes from the settings navigation. */
    const FOLDED_PAGES = [...CARD_PAGES, ...TAB_PAGES]

    /**
     * The shipped Plugins section row, used when the label captured while the
     * hub page was open is unavailable. Covers the languages the shipped
     * section ships dictionaries for.
     */
    const BACK_LABELS = [
      '内置插件', 'Built-in plugins', '組み込みプラグイン', 'Complementos integrados',
      'Plugins intégrés', 'Integrierte Plugins', 'Встроенные плагины', 'Plug-ins integrados',
    ]

    /** The portaled Settings dialog (shell contract: `data-shortcut-modal`). */
    const PANEL_SELECTOR = '[data-shortcut-modal="settings"]'

    /** Marker attribute set on every row this bundle hides. */
    const HIDDEN_ATTRIBUTE = 'data-plugin-settings-hub-hidden'

    /** Diagnostic endpoint served by this bundle's Host half. */
    const LOG_PATH = '/plugin-settings-hub/log'

    /* ------------------------------------------------------------------ *
     * Diagnostics
     * ------------------------------------------------------------------ */

    /**
     * Report one browser-side fact to the Host sink; failures stay silent
     * because diagnostics must never affect the page.
     * @param {string} kind - Event name.
     * @param {string} [detail] - Optional short payload.
     */
    function report(kind, detail) {
      try {
        const payload = JSON.stringify({ kind, detail: detail ?? '', at: new Date().toISOString() })
        if (typeof fetch === 'function') {
          void fetch(LOG_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: payload,
          }).catch(() => {})
        }
      } catch {
        /* Diagnostics are best effort. */
      }
    }

    /* ------------------------------------------------------------------ *
     * DOM helpers over the shell-rendered settings panel
     * ------------------------------------------------------------------ */

    /** Collapse whitespace and case so labels compare across renders. */
    function normalize(text) {
      return String(text ?? '').replace(/\s+/gu, ' ').trim().toLocaleLowerCase()
    }

    /** Whether one navigation label equals any candidate label. */
    function matchesAny(label, candidates) {
      const normalized = normalize(label)
      return normalized.length > 0 && candidates.some(candidate => normalize(candidate) === normalized)
    }

    /** The open settings dialog, if any. */
    function settingsPanel() {
      try {
        return document.querySelector(PANEL_SELECTOR)
      } catch {
        return null
      }
    }

    /** The section navigation rows of one settings panel. */
    function navigationButtons(panel) {
      if (panel === null) return []
      let nav = null
      try {
        nav = panel.querySelector(':scope > nav')
      } catch {
        nav = null
      }
      if (nav === null) nav = panel.querySelector('nav')
      if (nav === null) return []
      return Array.from(nav.querySelectorAll('button'))
    }

    /** The visible text of one navigation row (its icon contributes no text). */
    function navigationLabel(button) {
      return button.textContent ?? ''
    }

    /** Click the navigation row whose label matches one of the candidates. */
    function clickNavigationRow(candidates) {
      const button = navigationButtons(settingsPanel())
        .find(candidate => matchesAny(navigationLabel(candidate), candidates))
      if (button === undefined) return false
      button.click()
      return true
    }

    /** Undo every row this bundle hid; also used when a render fails. */
    function restoreHiddenRows() {
      for (const button of navigationButtons(settingsPanel())) {
        if (!button.hasAttribute(HIDDEN_ATTRIBUTE)) continue
        button.removeAttribute(HIDDEN_ATTRIBUTE)
        button.style.removeProperty('display')
      }
      if (highlightedRow !== null) highlightedRow.style.removeProperty('background')
      highlightedRow = null
    }

    /* ------------------------------------------------------------------ *
     * Navigation state store
     * ------------------------------------------------------------------ */

    /** @type {{ pages: Array<{ key: string, label: string }>, activeKey: string | null, ready: boolean }} */
    let snapshot = { pages: [], activeKey: null, ready: false }
    const listeners = new Set()
    /** Label of the shipped Plugins row, captured while the hub page is open. */
    let pluginsRowLabel = null
    /** The Plugins row carrying the borrowed selected fill, if any. */
    let highlightedRow = null
    /** Set when the hub page could not render; folding is then suspended. */
    let suspended = false

    /** Read the current store value. */
    function getSnapshot() {
      return snapshot
    }

    /** Subscribe to store updates. */
    function subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    }

    /** Replace the store value when it actually changed. */
    function publish(pages, activeKey, ready) {
      const unchanged = snapshot.activeKey === activeKey
        && snapshot.ready === ready
        && snapshot.pages.length === pages.length
        && snapshot.pages.every((page, index) => page.key === pages[index].key && page.label === pages[index].label)
      if (unchanged) return
      const previousKeys = snapshot.pages.map(page => page.key).join(',')
      snapshot = { pages, activeKey, ready }
      for (const listener of listeners) {
        try {
          listener()
        } catch {
          /* A subscriber must not break the others. */
        }
      }
      const nextKeys = pages.map(page => page.key).join(',')
      if (previousKeys !== nextKeys) report('pages', nextKeys)
    }

    /* ------------------------------------------------------------------ *
     * Navigation sync: hide folded rows, track the active one
     * ------------------------------------------------------------------ */

    let syncTimer = 0
    let panelObserver = null
    let observedPanel = null
    let bodyObserver = null
    let installed = false

    /** Schedule one debounced navigation sync. */
    function scheduleSync() {
      if (syncTimer !== 0) return
      syncTimer = setTimeout(runSync, 40)
    }

    /** Read the Settings navigation, hide the folded rows, publish the result. */
    function runSync() {
      syncTimer = 0
      if (suspended) return
      const panel = settingsPanel()
      const buttons = navigationButtons(panel)
      const pages = []
      let activeKey = null
      if (panel !== null && buttons.length > 0) {
        ensurePanelObserver(panel)
        for (const button of buttons) {
          const label = navigationLabel(button)
          const page = FOLDED_PAGES.find(candidate => matchesAny(label, candidate.labels))
          if (page === undefined) continue
          if (!button.hasAttribute(HIDDEN_ATTRIBUTE)) {
            button.setAttribute(HIDDEN_ATTRIBUTE, '')
            button.style.display = 'none'
          }
          if (button.getAttribute('aria-current') === 'true') activeKey = page.key
          if (CARD_PAGES.includes(page) && !pages.some(entry => entry.key === page.key)) {
            pages.push({ key: page.key, label: label.trim() })
          }
        }
        // The Plugins row keeps a borrowed selected fill while a folded page
        // is open, because the active row itself is hidden.
        highlightPluginsRow(activeKey !== null)
      } else {
        stopPanelObserver()
        highlightPluginsRow(false)
      }
      publish(pages, activeKey, panel !== null && buttons.length > 0)
    }

    /** Mark the shipped Plugins row as the current section while a folded page shows. */
    function highlightPluginsRow(on) {
      if (pluginsRowLabel === null) return
      const row = on
        ? navigationButtons(settingsPanel()).find(candidate => matchesAny(navigationLabel(candidate), [pluginsRowLabel]))
        : undefined
      if (highlightedRow !== null && highlightedRow !== row) {
        highlightedRow.style.removeProperty('background')
      }
      highlightedRow = row ?? null
      if (row === undefined) return
      if (row.style.getPropertyValue('background') === '') {
        row.style.setProperty('background', 'var(--dsw-specific-sidebar-nav-item-active)')
      }
    }

    /** Observe the open panel while it exists (labels, active row, remounts). */
    function ensurePanelObserver(panel) {
      if (panelObserver !== null && observedPanel === panel) return
      stopPanelObserver()
      observedPanel = panel
      panelObserver = new MutationObserver(() => { scheduleSync() })
      panelObserver.observe(panel, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-current'],
      })
    }

    /** Detach the panel observer. */
    function stopPanelObserver() {
      if (panelObserver !== null) panelObserver.disconnect()
      panelObserver = null
      observedPanel = null
    }

    /** Install the body-level observer that notices the dialog opening/closing. */
    function installObservers() {
      if (installed) return
      installed = true
      try {
        // Opening and closing the dialog must not leave the folded rows visible
        // for a frame: the observer callback runs before paint, so sync now.
        bodyObserver = new MutationObserver(() => { runSync() })
        bodyObserver.observe(document.body, { childList: true })
      } catch {
        bodyObserver = null
      }
      runSync()
      report('boot', 'observer installed')
    }

    /** Remove every observer and the store's transient state. */
    function uninstallObservers() {
      if (!installed) return
      installed = false
      if (bodyObserver !== null) bodyObserver.disconnect()
      bodyObserver = null
      stopPanelObserver()
      if (syncTimer !== 0) {
        clearTimeout(syncTimer)
        syncTimer = 0
      }
      // A disposed bundle must not leave another plugin's row hidden.
      restoreHiddenRows()
      publish([], null, false)
    }

    /* ------------------------------------------------------------------ *
     * Actions
     * ------------------------------------------------------------------ */

    /** Remember the shipped Plugins row while the hub page itself is open. */
    function capturePluginsRow() {
      const active = navigationButtons(settingsPanel())
        .find(button => button.getAttribute('aria-current') === 'true')
      if (active === undefined) return
      const label = navigationLabel(active).trim()
      if (label.length > 0 && label !== pluginsRowLabel) pluginsRowLabel = label
    }

    /** Open one folded plugin page. */
    function openPage(key) {
      const page = CARD_PAGES.find(candidate => candidate.key === key)
      if (page === undefined) return
      const opened = clickNavigationRow(page.labels)
      report(opened ? 'open' : 'open-missing', key)
      if (!opened) return
      // The card unmounts with the page; move focus into the new page so a
      // keyboard user does not land back on <body>.
      setTimeout(() => {
        const panel = settingsPanel()
        if (panel !== null && typeof panel.focus === 'function') panel.focus()
      }, 0)
    }

    /** Return to the shipped Plugins page from a folded plugin page. */
    function backToPlugins() {
      report('back-attempt', pluginsRowLabel ?? '')
      if (pluginsRowLabel !== null && clickNavigationRow([pluginsRowLabel])) {
        report('back', 'captured')
        return
      }
      const fallback = clickNavigationRow(BACK_LABELS)
      report(fallback ? 'back' : 'back-missing', 'fallback')
    }

    /* ------------------------------------------------------------------ *
     * Components
     * ------------------------------------------------------------------ */

    /** Subscribe a component to the navigation store. */
    function useNavigationState() {
      const [state, setState] = useState(getSnapshot)
      useEffect(() => {
        const update = () => { setState(getSnapshot()) }
        update()
        return subscribe(update)
      }, [])
      return state
    }

    /** Render the list of folded plugin settings pages. */
    function SettingsHubPage({ t }) {
      const state = useNavigationState()
      useEffect(() => {
        // The panel may have mounted between the body mutation and the
        // debounced sync; run once here so the first paint already lists pages.
        capturePluginsRow()
        runSync()
      }, [])
      let body = null
      if (state.ready) {
        body = state.pages.length === 0
          ? h('p', { key: 'empty', className: 'dshph-empty' }, t('empty'))
          : h('ul', { key: 'list', className: 'dshph-list' }, state.pages.map(page => {
            const pageDefinition = CARD_PAGES.find(candidate => candidate.key === page.key)
            const description = pageDefinition === undefined ? '' : t(pageDefinition.description)
            return h('li', { key: page.key, className: 'dshph-item' },
              h('button', {
                type: 'button',
                className: 'dshph-card',
                'aria-label': `${t('open')}: ${page.label}`,
                onClick: () => { openPage(page.key) },
              }, [
                h('span', { key: 'main', className: 'dshph-main' }, [
                  h('span', { key: 'title', className: 'dshph-title' }, page.label),
                  description.length === 0
                    ? null
                    : h('span', { key: 'description', className: 'dshph-description' }, description),
                ]),
                h('span', { key: 'chevron', className: 'dshph-chevron', 'aria-hidden': 'true' }, '\u203a'),
              ]))
          }))
      }
      return h('div', { className: 'dshph' }, [
        h('p', { key: 'intro', className: 'dshph-intro' }, t('intro')),
        body,
      ])
    }

    /** Render the header action that leaves a folded plugin page. */
    function SettingsHubBack({ t }) {
      const state = useNavigationState()
      useEffect(() => {
        if (state.activeKey !== null) report('back-shown', state.activeKey)
      }, [state.activeKey])
      if (state.activeKey === null) return null
      return h('button', {
        type: 'button',
        className: 'dshph-back',
        onClick: () => { backToPlugins() },
      }, [
        h('span', { key: 'arrow', 'aria-hidden': 'true' }, '\u2190'),
        h('span', { key: 'label' }, t('back')),
      ])
    }

    /** Contain a render failure so the slot entry cannot abdicate the seat. */
    class SafeRender extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        // A crashed hub must not leave the navigation without its entries.
        suspended = true
        restoreHiddenRows()
        publish([], null, false)
        report('render-error', String((error && error.message) || error))
      }

      render() {
        return this.state.failed ? null : this.props.children
      }
    }

    /** Wrap one component in the render guard. */
    function guarded(component) {
      return props => h(SafeRender, null, h(component, props))
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const CSS = [
      '.dshph{display:flex;flex-direction:column;gap:12px;max-width:640px}',
      '.dshph-intro,.dshph-empty{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}',
      '.dshph-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}',
      '.dshph-item{margin:0}',
      '.dshph-card{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:12px 14px;border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}',
      '@media (hover:hover){.dshph-card:hover{border-color:var(--dsw-alias-border-l2)}}',
      '.dshph-card:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}',
      '.dshph-main{display:flex;flex:1;flex-direction:column;gap:2px;min-width:0}',
      '.dshph-title{font-size:14px;font-weight:500;line-height:20px}',
      '.dshph-description{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dshph-chevron{flex:none;color:var(--dsw-alias-label-secondary);font-size:16px;line-height:16px}',
      '.dshph-back{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer}',
      '@media (hover:hover){.dshph-back:hover{background:var(--dsw-alias-bg-layer-2)}}',
      '.dshph-back:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}',
    ].join('\n')

    /* ------------------------------------------------------------------ *
     * Plugin
     * ------------------------------------------------------------------ */

    /** Services this browser half needs. */
    const inject = ['slots', 'locale']

    /**
     * Register the dictionaries, the navigation grouping, and the two slot
     * entries (hub tab and back action).
     * @param {object} ctx - Client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plugin-settings-hub: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.effect(() => {
        const style = document.createElement('style')
        style.dataset.pluginSettingsHub = ''
        style.textContent = CSS
        document.head.appendChild(style)
        return () => { style.remove() }
      }, 'plugin-settings-hub: styles')

      ctx.effect(() => {
        installObservers()
        return () => { uninstallObservers() }
      }, 'plugin-settings-hub: navigation grouping')

      ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
        name: 'settings.plugins.tab',
        id: 'plugin-settings-hub',
        order: 5,
        label: () => t('tab'),
        locale: NS,
        inject: () => ({ t }),
      }, guarded(SettingsHubPage)))

      ctx.slots.inject('settings.action', () => ctx.slots.register({
        name: 'settings.action',
        id: 'plugin-settings-hub-back',
        order: 50,
        label: () => t('back'),
        locale: NS,
        inject: () => ({ t }),
      }, guarded(SettingsHubBack)))

      report('registered', 'tab+action')
    }

    return { inject, apply }
  },
})

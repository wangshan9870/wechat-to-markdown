import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { beforeAll, describe, expect, it } from 'vitest'

let source = ''

beforeAll(async () => {
  source = await readFile(new URL('../site/site.js', import.meta.url), 'utf8')
})

describe('purchase page source context', () => {
  it('uses only whitelisted source values and keeps analytics URLs query-free', () => {
    const page = runSiteScript('?surface=library&trigger=trial_used&message=secret-card-key')
    const pageView = page.analyticsCalls.find((call) => call[0] === 'event' && call[1] === 'page_view')

    expect(page.contextElement.hidden).toBe(false)
    expect(page.contextElement.textContent).toContain('免费合集试用')
    expect(page.contextElement.textContent).not.toContain('secret-card-key')
    expect(pageView).toBeUndefined()

    page.clickTrackedLink({
      trackEvent: 'pricing_cta_clicked',
      trackPlacement: 'purchase_online',
      trackTarget: 'online_store',
    })
    const cta = page.analyticsCalls.find((call) => call[0] === 'event' && call[1] === 'pricing_cta_clicked')
    expect(cta).toBeUndefined()
    expect(page.analyticsCalls).toEqual([])
    expect(JSON.stringify(page.analyticsCalls)).not.toContain('secret-card-key')
  })

  it('ignores unknown source and trigger values', () => {
    const page = runSiteScript('?surface=private_page&trigger=custom_message')
    const pageView = page.analyticsCalls.find((call) => call[0] === 'event' && call[1] === 'page_view')

    expect(page.contextElement.hidden).toBe(true)
    expect(pageView).toBeUndefined()
  })
})

describe('localized purchase navigation', () => {
  it('shows English context without analytics and preserves only a valid receipt fragment', () => {
    const receipt = 'a'.repeat(64)
    const page = runSiteScript('?trigger=trial_used&message=secret', '/en/purchase/', 'granted', `#receipt=${receipt}&product=1&order=WX123&private=discard`)
    expect(page.contextElement.textContent).toContain('free collection trial')
    expect(page.analyticsCalls).toEqual([])
    expect(page.languageSwitch.hash).toBe(`receipt=${receipt}&product=1&order=WX123`)
  })
  it('does not forward invalid receipts', () => {
    const page = runSiteScript('', '/en/purchase/', '', '#receipt=secret&product=1')
    expect(page.languageSwitch.hash).toBe('')
  })
})

describe('optional website analytics', () => {
  it('loads nothing before consent, allows refusal and remembers consent', () => {
    const fresh = runSiteScript('', '/', '')
    expect(fresh.analyticsCalls).toEqual([])
    fresh.choose('denied')
    expect(fresh.analyticsCalls).toEqual([])
    const accepted = runSiteScript('?secret=hidden', '/', 'granted')
    expect(accepted.analyticsCalls.some(call => call[1] === 'page_view')).toBe(true)
    expect(JSON.stringify(accepted.analyticsCalls)).not.toContain('secret')
    accepted.choose('denied')
    const count = accepted.analyticsCalls.length
    accepted.clickTrackedLink({ trackEvent: 'install_cta_clicked' })
    expect(accepted.analyticsCalls).toHaveLength(count)
    expect(accepted.disabled()).toBe(true)
  })
  it('purchase pages never load analytics even with consent', () => {
    for (const path of ['/purchase/', '/en/purchase/', '/en/purchase', '/en/purchase/index.html']) {
      expect(runSiteScript('', path, 'granted').analyticsCalls).toEqual([])
    }
  })
})

function runSiteScript(search, pathname = '/purchase/', choice = '', hash = '') {
  const listeners = new Map()
  const elements = []

  class FakeElement {
    constructor(dataset = {}) {
      this.dataset = dataset
    }

    closest() {
      return this
    }
  }

  class FakeHTMLElement extends FakeElement {
    hidden = true
    textContent = ''
    listeners = new Map()
    setAttribute() {}
    addEventListener(type, listener) { this.listeners.set(type, listener) }
    focus() {}
    querySelector() { return new FakeHTMLElement() }
  }

  const contextElement = new FakeHTMLElement()
  const languageSwitch = new FakeHTMLElement()
  const window = {
    addEventListener() {},
    WX2MD_SITE_CONFIG: { ga4MeasurementId: 'G-TEST123' },
    location: {
      origin: 'https://wx2md.com',
      pathname,
      hostname: 'wx2md.com',
      search,
      hash,
    },
    localStorage: { getItem() { return choice }, setItem() {} },
  }
  const document = {
    body: { dataset: { contentCluster: 'purchase' }, append(...items) { elements.push(...items) } },
    cookie: '',
    documentElement: { lang: pathname.startsWith('/en/') ? 'en' : 'zh-CN', classList: { add() {} } },
    title: 'Purchase',
    head: { append() {} },
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    createElement() {
      return new FakeHTMLElement()
    },
    querySelector() { return languageSwitch },
    getElementById(id) {
      return id === 'purchase-context' ? contextElement : null
    },
  }

  vm.runInNewContext(source, {
    window,
    document,
    Element: FakeElement,
    HTMLElement: FakeHTMLElement,
    URLSearchParams,
    encodeURIComponent,
  })

  return {
    contextElement,
    languageSwitch,
    choose(choice) { elements[0].listeners.get('click')({ target: new FakeHTMLElement({ choice }) }) },
    disabled() { return window['ga-disable-G-TEST123'] },
    get analyticsCalls() {
      return (window.dataLayer || []).map((entry) => Array.from(entry))
    },
    clickTrackedLink(dataset) {
      listeners.get('click')?.({ target: new FakeHTMLElement(dataset) })
    },
  }
}

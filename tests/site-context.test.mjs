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
    expect(pageView?.[2]).toMatchObject({
      page_location: 'https://wx2md.com/purchase/',
      source_surface: 'library',
      source_trigger: 'trial_used',
    })

    page.clickTrackedLink({
      trackEvent: 'pricing_cta_clicked',
      trackPlacement: 'purchase_online',
      trackTarget: 'online_store',
    })
    const cta = page.analyticsCalls.find((call) => call[0] === 'event' && call[1] === 'pricing_cta_clicked')
    expect(cta?.[2]).toMatchObject({ source_surface: 'library', source_trigger: 'trial_used' })
    expect(JSON.stringify(page.analyticsCalls)).not.toContain('secret-card-key')
  })

  it('ignores unknown source and trigger values', () => {
    const page = runSiteScript('?surface=private_page&trigger=custom_message')
    const pageView = page.analyticsCalls.find((call) => call[0] === 'event' && call[1] === 'page_view')

    expect(page.contextElement.hidden).toBe(true)
    expect(pageView?.[2]).not.toHaveProperty('source_surface')
    expect(pageView?.[2]).not.toHaveProperty('source_trigger')
  })
})

function runSiteScript(search) {
  const listeners = new Map()

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
  }

  const contextElement = new FakeHTMLElement()
  const window = {
    WX2MD_SITE_CONFIG: { ga4MeasurementId: 'G-TEST123' },
    location: {
      origin: 'https://wx2md.com',
      pathname: '/purchase/',
      search,
    },
  }
  const document = {
    body: { dataset: { contentCluster: 'purchase' } },
    documentElement: { classList: { add() {} } },
    title: 'Purchase',
    head: { append() {} },
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    createElement() {
      return {}
    },
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
    get analyticsCalls() {
      return window.dataLayer.map((entry) => Array.from(entry))
    },
    clickTrackedLink(dataset) {
      listeners.get('click')?.({ target: new FakeHTMLElement(dataset) })
    },
  }
}

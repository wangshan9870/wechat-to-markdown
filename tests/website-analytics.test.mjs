import { describe, expect, it } from 'vitest'
import { attributionFrom, classifyPage, classifyEnvironment, createWebsiteAnalytics } from '../site/website-analytics.js'
const storage = () => { const data = new Map(); return { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k), data } }
function environment(overrides = {}) {
  const requests = []
  return { requests, localStorage: storage(), sessionStorage: storage(), location: { search: '?utm_source=wechat&utm_campaign=launch#private', pathname: '/purchase/', origin: 'https://wx2md.com', hash: '#receipt=private' }, navigator: { userAgent: 'Mozilla/5.0 Chrome/120.0 Mobile' }, document: { referrer: 'https://example.com/private?email=secret', documentElement: { lang: 'en' } }, crypto: { randomUUID: () => crypto.randomUUID() }, fetch: (...args) => { requests.push(args); return Promise.resolve({ ok: true }) }, ...overrides }
}
const config = { productCode: 'wtm', apiBase: 'https://work.bzjkmn.cn/api/v1', appVersion: '1' }
describe('website source privacy', () => {
  it('uses validated source codes and never returns URLs or free text', () => {
    expect(attributionFrom('?utm_source=wechat&utm_campaign=launch&email=secret', 'https://private.example/name')).toEqual({ source: 'wechat', medium: 'campaign', campaign: 'launch', content: 'none' })
    expect(attributionFrom('?utm_source=person%40example.com&utm_campaign=PRIVATE', 'https://www.google.com/search?q=secret').source).toBe('google')
    expect(attributionFrom('', 'https://www.google.com.evil.com/secret').source).toBe('referral')
    expect(attributionFrom('', '', 'https://wx2md.com').source).toBe('direct_unknown')
    expect(attributionFrom('', 'https://wx2md.com/purchase/#secret', 'https://wx2md.com').source).toBe('direct_unknown')
  })
  it('classifies only coarse page, browser and device codes', () => {
    expect(classifyPage('/en/purchase/index.html')).toBe('purchase')
    expect(classifyPage('/private-token/')).toBe('other')
    expect(classifyEnvironment('Chrome/120 Edg/120')).toEqual({ browser: 'edge', device: 'desktop' })
    expect(classifyEnvironment('iPad Safari/123')).toEqual({ browser: 'safari', device: 'tablet' })
  })
  it('has no requests, identity or attribution before consent; withdraw clears and stops', () => {
    const env = environment(); const analytics = createWebsiteAnalytics(env, config)
    analytics.event('website_page_view'); expect(analytics.orderAttribution()).toBeNull()
    expect(env.requests).toHaveLength(0); expect(env.localStorage.data.size).toBe(0); expect(env.sessionStorage.data.size).toBe(0)
    analytics.setConsent('granted'); analytics.event('website_page_view')
    expect(env.requests).toHaveLength(1)
    const [url, options] = env.requests[0]; const body = JSON.parse(options.body)
    expect(url).toBe('https://work.bzjkmn.cn/api/v1/telemetry/events')
    expect(options.credentials).toBe('omit'); expect(options.referrerPolicy).toBe('no-referrer')
    expect(body.properties).toEqual({ source: 'wechat', medium: 'campaign', campaign: 'none', content: 'none', browser: 'chrome', device: 'mobile', page: 'purchase' })
    expect(options.body).not.toMatch(/private|secret|receipt|User-Agent|example\.com/)
    analytics.setConsent('denied'); analytics.event('website_purchase_clicked')
    expect(analytics.orderAttribution()).toBeNull(); expect(env.requests).toHaveLength(1)
    expect(env.localStorage.getItem('nas-website:wtm:id')).toBeUndefined(); expect(env.sessionStorage.data.size).toBe(0)
  })
  it('retains attribution on internal navigation, updates explicit campaigns and isolates products', () => {
    const env = environment(); const first = createWebsiteAnalytics(env, config); first.setConsent('granted')
    const initial = first.orderAttribution(); env.location.search = ''
    const next = createWebsiteAnalytics(env, config); expect(next.orderAttribution()).toEqual(initial)
    expect(next.orderAttribution()).not.toHaveProperty('installationId')
    env.location.search = '?utm_source=bing&utm_campaign=summer'
    const campaign = createWebsiteAnalytics(env, config); expect(campaign.orderAttribution().source).toBe('bing'); expect(campaign.orderAttribution().campaign).toBe('summer')
    env.location.search = '?utm_source=invalid%40email'
    expect(createWebsiteAnalytics(env, config).orderAttribution()).toEqual(campaign.orderAttribution())
    env.location.search = '?source=github&campaign=release'
    expect(createWebsiteAnalytics(env, config).orderAttribution().source).toBe('github')
    const other = createWebsiteAnalytics(env, { ...config, productCode: 'other' }); expect(other.orderAttribution()).toBeNull(); other.setConsent('granted')
    expect(other.orderAttribution().source).toBe('github')
    const ids = env.requests.map(([, opts]) => JSON.parse(opts.body).installationId); expect(new Set(ids).size).toBe(2)
  })
  it('validates product codes and preserves supported version strings', () => {
    for (const productCode of ['1product', 'product-code', 'a', 'a'.repeat(33)]) {
      const env = environment(); const analytics = createWebsiteAnalytics(env, { ...config, productCode })
      analytics.setConsent('granted'); expect(analytics.orderAttribution()).toBeNull(); expect(env.requests).toHaveLength(0)
    }
    for (const appVersion of ['1.0.0', '2.1.0-rc.1+Build_2']) {
      const env = environment(); createWebsiteAnalytics(env, { ...config, productCode: 'other_product', appVersion }).setConsent('granted')
      expect(JSON.parse(env.requests[0][1].body).appVersion).toBe(appVersion)
    }
  })
  it('survives blocked storage and telemetry failures without blocking purchases', () => {
    const unavailable = { getItem() { throw Error() }, setItem() { throw Error() }, removeItem() { throw Error() } }
    const env = environment({ localStorage: unavailable, sessionStorage: unavailable, fetch: () => Promise.reject(Error('offline')) })
    const analytics = createWebsiteAnalytics(env, config)
    expect(() => analytics.setConsent('granted')).not.toThrow(); expect(analytics.orderAttribution().source).toBe('wechat')
    expect(() => analytics.setConsent('denied')).not.toThrow()
  })
  it('ignores non-allowlisted events and cross-tab withdrawal stops pending actions', () => {
    let listener; const env = environment({ addEventListener: (_, fn) => { listener = fn } }); const analytics = createWebsiteAnalytics(env, config)
    analytics.setConsent('granted'); analytics.event('payment_success'); listener({ key: 'nas-website:wtm:consent', newValue: 'denied' }); analytics.event('website_purchase_clicked')
    expect(env.requests).toHaveLength(1); expect(analytics.orderAttribution()).toBeNull()
  })
})

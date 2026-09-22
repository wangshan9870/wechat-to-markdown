// Website identity and attribution are isolated from extension and order credentials.
const code = value => typeof value === 'string' && /^[a-z0-9_-]{1,64}$/.test(value) ? value : ''
export function classifyEnvironment(ua = '') {
  return {
    browser: /Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : /Chrome\/|CriOS\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other',
    device: /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'tablet' : /Mobile|iPhone/i.test(ua) ? 'mobile' : ua ? 'desktop' : 'other',
  }
}
export function classifyPage(path = '/') {
  const page = path.replace(/^\/en(?=\/|$)/, '').replace(/\/index\.html$/, '/').split('/').filter(Boolean)[0] || 'home'
  if (['home', 'pricing', 'purchase', 'download', 'support', 'privacy', 'terms'].includes(page)) return page
  return ['start', 'offline-install', 'wechat-to-markdown', 'wechat-collection', 'wechat-to-obsidian', 'faq'].includes(page) ? 'guide' : 'other'
}
export function attributionFrom(search = '', referrer = '', origin = '') {
  const params = new URLSearchParams(search)
  const source = code(params.get('utm_source')) || code(params.get('source'))
  if (source) return { source, medium: code(params.get('utm_medium')) || code(params.get('medium')) || 'campaign', campaign: code(params.get('utm_campaign')) || code(params.get('campaign')) || 'none', content: code(params.get('utm_content')) || code(params.get('content')) || 'none' }
  let host = ''
  try { const url = new URL(referrer); if (url.origin !== origin) host = url.hostname.toLowerCase() } catch { /* No usable referrer. */ }
  const known = [['google', /(^|\.)google\.(?:com|cn|co\.uk|com\.hk|co\.jp|de|fr|ca|com\.au)$/], ['baidu', /(^|\.)baidu\.com$/], ['bing', /(^|\.)bing\.com$/], ['xiaohongshu', /(^|\.)xiaohongshu\.com$/], ['wechat', /(^|\.)weixin\.qq\.com$/], ['zhihu', /(^|\.)zhihu\.com$/], ['github', /(^|\.)github\.com$/]]
  const match = known.find(([, pattern]) => pattern.test(host))
  return { source: match?.[0] || (host ? 'referral' : 'direct_unknown'), medium: match && ['google', 'baidu', 'bing'].includes(match[0]) ? 'organic' : host ? 'referral' : 'none', campaign: 'none', content: 'none' }
}
export function createWebsiteAnalytics(env, config = {}) {
  const productCode = typeof config.productCode === 'string' && /^[a-z][a-z0-9_]{1,31}$/.test(config.productCode) ? config.productCode : ''
  const appVersion = typeof config.appVersion === 'string' && /^[A-Za-z0-9._+-]{1,32}$/.test(config.appVersion) ? config.appVersion : '1'
  let apiBase = ''
  try { const url = new URL(config.apiBase); if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash) apiBase = url.href.replace(/\/$/, '') } catch { /* Disabled until configured. */ }
  const prefix = `nas-website:${productCode}:`
  const choiceKey = config.consentKey || `${prefix}consent`
  const read = (storage, key) => { try { return env[storage].getItem(key) } catch { return null } }
  const write = (storage, key, value) => { try { env[storage].setItem(key, value) } catch { /* In-memory fallback. */ } }
  const remove = (storage, key) => { try { env[storage].removeItem(key) } catch { /* Unavailable storage. */ } }
  let granted = read('localStorage', choiceKey) === 'granted'
  let identity = '', attribution = null, pageSent = false
  function clear() { identity = ''; attribution = null; remove('localStorage', prefix + 'id'); remove('sessionStorage', prefix + 'attribution') }
  if (!granted) clear()
  env.addEventListener?.('storage', event => {
    if ((event.key === choiceKey || event.key === null) && event.newValue !== 'granted') { granted = false; clear(); pageSent = false }
  })
  function context() {
    if (!granted || !productCode || !apiBase) return null
    if (!attribution) {
      let saved
      try { saved = JSON.parse(read('sessionStorage', prefix + 'attribution')) } catch { /* Ignore damaged storage. */ }
      const params = new URLSearchParams(env.location.search)
      const explicitSource = code(params.get('utm_source')) || code(params.get('source'))
      attribution = !explicitSource && saved && ['source', 'medium', 'campaign', 'content'].every(key => code(saved[key]))
        ? Object.fromEntries(['source', 'medium', 'campaign', 'content'].map(key => [key, saved[key]]))
        : attributionFrom(env.location.search, env.document.referrer, env.location.origin)
      write('sessionStorage', prefix + 'attribution', JSON.stringify(attribution))
    }
    return { ...attribution, ...classifyEnvironment(env.navigator.userAgent) }
  }
  function event(name) {
    if (!['website_page_view', 'website_purchase_clicked'].includes(name)) return
    const properties = context()
    if (!properties || (name === 'website_page_view' && pageSent)) return
    try {
      identity ||= read('localStorage', prefix + 'id') || env.crypto.randomUUID()
      if (!/^[a-f0-9-]{36}$/.test(identity)) identity = env.crypto.randomUUID()
      write('localStorage', prefix + 'id', identity)
      const body = { productCode, channel: 'website', installationId: identity, appVersion, platform: 'website', locale: env.document.documentElement.lang === 'en' ? 'en' : 'zh-CN', name, eventId: env.crypto.randomUUID(), properties: { ...properties, page: classifyPage(env.location.pathname) } }
      if (name === 'website_page_view') pageSent = true
      Promise.resolve(env.fetch(`${apiBase}/telemetry/events`, { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify(body) })).catch(() => {})
    } catch { /* Analytics must never block a page or purchase. */ }
  }
  return { event, orderAttribution: () => context(), setConsent(value) { granted = value === 'granted'; write('localStorage', choiceKey, granted ? 'granted' : 'denied'); if (!granted) { clear(); pageSent = false } else event('website_page_view') } }
}
export const websiteAnalytics = typeof window === 'undefined' ? null : createWebsiteAnalytics(window, window.WX2MD_SITE_CONFIG?.websiteAnalytics)

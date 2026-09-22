export const pricingConfig = Object.freeze({
  apiBase: globalThis.window?.WX2MD_SITE_CONFIG?.apiBase || 'https://work.bzjkmn.cn/api/v1/',
  siteOrigin: globalThis.window?.WX2MD_SITE_CONFIG?.siteOrigin || globalThis.location?.origin,
  productName: globalThis.window?.WX2MD_SITE_CONFIG?.productName || 'WeChat to Markdown',
  productCode: globalThis.window?.WX2MD_SITE_CONFIG?.productCode || 'wtm',
})

export function money(fen) {
  return `¥${(fen / 100).toFixed(fen % 100 ? 2 : 0)}`
}

export function planText(plan, lang = 'zh-CN') {
  const en = lang === 'en'
  const names = en ? { monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime', custom: 'Custom' }
    : { monthly: '月度', yearly: '年度', lifetime: '永久买断', custom: '自定义' }
  const duration = plan.durationDays === null ? (en ? 'Lifetime' : '永久授权') : `${plan.durationDays} ${en ? 'days from first activation' : '天，自首次激活起算'}`
  return `${names[plan.planType]} · ${duration} · ${plan.maxDevices} ${en ? 'devices' : '台设备'}`
}

export async function fetchPlans(config, fetcher = fetch) {
  const response = await fetcher(config.apiBase + 'pricing/plans/list', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    body: JSON.stringify({ productCode: config.productCode }), signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Quote unavailable')
  const result = await response.json()
  if (result.code !== 200 || !Array.isArray(result.data)) throw new Error('Invalid quote')
  const plans = result.data.filter(p => p?.productCode === config.productCode)
  const ids = new Set()
  for (const p of plans) {
    if (!Number.isSafeInteger(p.id) || p.id <= 0 || ids.has(p.id)
      || !Number.isSafeInteger(p.priceFen) || p.priceFen <= 0
      || !Number.isSafeInteger(p.regularPriceFen) || p.regularPriceFen <= 0
      || !Number.isSafeInteger(p.maxDevices) || p.maxDevices < 1
      || !Number.isFinite(p.serverTime) || p.serverTime <= 0
      || !['monthly', 'yearly', 'lifetime', 'custom'].includes(p.planType)
      || typeof p.name !== 'string' || typeof p.checkoutEnabled !== 'boolean' || typeof p.earlyBirdActive !== 'boolean'
      || !(p.durationDays === null || Number.isSafeInteger(p.durationDays) && p.durationDays > 0)
      || p.planType === 'lifetime' && p.durationDays !== null
      || p.planType === 'monthly' && p.durationDays !== 30
      || p.planType === 'yearly' && p.durationDays !== 365
      || ![p.earlyBirdEndsAt, p.saleEndsAt].every(t => t === null || Number.isFinite(t) && t > 0)
      || p.earlyBirdActive && !(p.earlyBirdEndsAt > p.serverTime)) throw new Error('Invalid plan')
    ids.add(p.id)
  }
  return plans.filter(p => p.saleEndsAt === null || p.saleEndsAt > p.serverTime)
}

// One in-memory quote per document. No localStorage, service-worker or build-time cache.
export function createQuoteStore(config, { fetcher = globalThis.fetch, now = () => Date.now() } = {}) {
  let value = { status: 'loading', plans: [], selectedId: null }
  let validUntil = 0
  let initialized = false
  let pending = null
  const listeners = new Set()
  const publish = () => listeners.forEach(fn => fn(value))
  const isFresh = () => value.status === 'ready' && now() < validUntil
  const selected = () => isFresh() ? value.plans.find(p => p.id === value.selectedId) || null : null
  function refresh() {
    if (pending) return pending
    const started = now()
    value = { ...value, status: 'loading', plans: [] }
    publish()
    pending = (async () => {
      try {
        const plans = await fetchPlans(config, fetcher)
        const remaining = plans.flatMap(p => [p.earlyBirdActive ? p.earlyBirdEndsAt : null, p.saleEndsAt]
          .filter(t => t !== null).map(t => (t - p.serverTime) * 1000))
        validUntil = started + Math.min(120000, ...remaining)
        if (plans.length && validUntil <= now()) throw new Error('Stale quote')
        const selectedId = plans.some(p => p.id === value.selectedId) ? value.selectedId
          : !initialized && plans.length === 1 ? plans[0].id : null
        initialized = true
        value = { status: plans.length ? 'ready' : 'empty', plans, selectedId }
      } catch {
        value = { ...value, status: 'error', plans: [] }
      } finally { pending = null }
      publish()
      return value
    })()
    return pending
  }
  return {
    refresh, isFresh, selected, state: () => value,
    refreshIn: () => Math.max(0, validUntil - now()),
    select(id) {
      value = { ...value, selectedId: isFresh() && value.plans.some(p => p.id === id) ? id : null }
      publish()
    },
    subscribe(fn) { listeners.add(fn); fn(value); return () => listeners.delete(fn) },
  }
}

export const quotes = createQuoteStore(pricingConfig)

function initializePricing() {
  const roots = [...document.querySelectorAll('[data-pricing]')]
  if (!roots.length) return
  const en = document.documentElement.lang === 'en'
  const t = (zh, english) => en ? english : zh
  const purchasePath = en ? '/en/purchase/' : '/purchase/'
  const node = (tag, className, content) => {
    const element = document.createElement(tag)
    if (className) element.className = className
    if (content) element.textContent = content
    return element
  }
  let timer
  const schema = node('script')
  schema.type = 'application/ld+json'
  schema.id = 'live-price-offers'
  document.head.append(schema)
  quotes.subscribe(state => {
    clearTimeout(timer)
    schema.textContent = ''
    for (const root of roots) {
      root.replaceChildren()
      root.setAttribute('aria-busy', String(state.status === 'loading'))
      if (state.status !== 'ready') {
        root.append(node('p', 'pricing-status', state.status === 'loading' ? t('正在查询最新价格…', 'Loading current prices…')
          : state.status === 'empty' ? t('当前暂无可售套餐，请联系支持。', 'No plans are currently available. Contact support.')
            : t('暂时无法获取价格，请重试或联系微信支持。', 'Prices are unavailable. Retry or contact WeChat support.')))
        if (state.status !== 'loading') {
          const retry = node('button', 'button button-secondary', t('重新查询价格', 'Retry prices'))
          retry.type = 'button'
          retry.addEventListener('click', () => quotes.refresh())
          root.append(retry)
        }
        continue
      }
      const grid = node('div', 'live-plans')
      for (const p of state.plans) {
        const card = node('article', 'live-plan')
        card.append(node('h3', '', planText(p, en ? 'en' : 'zh-CN').split(' · ')[0]))
        if (!en || state.plans.filter(other => other.planType === p.planType).length > 1) card.append(node('p', 'plan-name', p.name))
        card.append(node('strong', 'live-price', money(p.priceFen)))
        card.append(node('p', 'plan-entitlement', planText(p, en ? 'en' : 'zh-CN')))
        if (p.earlyBirdActive) {
          const deadline = new Intl.DateTimeFormat(en ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(p.earlyBirdEndsAt * 1000))
          card.append(node('p', 'plan-promotion', t(`早鸟价 · ${deadline}（北京时间）结束，之后 ${money(p.regularPriceFen)}`, `Early bird · Ends ${deadline} (Beijing time), then ${money(p.regularPriceFen)}`)))
        }
        card.append(node('small', '', t('一次性购买，不自动续费', 'One-time purchase. No automatic renewal.')))
        if (!p.checkoutEnabled) card.append(node('p', 'pricing-status', t('在线支付暂未开放，可联系微信购买。', 'Online payment is unavailable. Contact WeChat support.')))
        const link = node('a', 'button button-secondary', t('选择此套餐', 'Choose this plan'))
        link.href = `${purchasePath}?plan=${p.id}#choose`
        if (root.dataset.pricing === 'purchase') {
          link.href = '#online'
          link.addEventListener('click', () => quotes.select(p.id))
        }
        card.append(link)
        grid.append(card)
      }
      root.append(grid)
    }
    if (state.status === 'ready') {
      schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': `${pricingConfig.siteOrigin}/#software`, name: pricingConfig.productName, offers: state.plans.map(p => ({ '@type': 'Offer', name: p.name, sku: String(p.id), price: (p.priceFen / 100).toFixed(2), priceCurrency: 'CNY', url: `${pricingConfig.siteOrigin}${purchasePath}?plan=${p.id}`, availability: p.checkoutEnabled ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', ...((p.earlyBirdActive || p.saleEndsAt) ? { validThrough: new Date(Math.min(...[p.earlyBirdActive ? p.earlyBirdEndsAt : null, p.saleEndsAt].filter(t => t !== null)) * 1000).toISOString() } : {}) })) })
      timer = setTimeout(() => quotes.refresh(), quotes.refreshIn())
    }
  })
  const freshen = () => { if (!document.hidden && !quotes.isFresh()) quotes.refresh() }
  document.addEventListener('visibilitychange', freshen)
  window.addEventListener('pageshow', freshen)
  quotes.refresh()
}

if (typeof document !== 'undefined') initializePricing()

import { describe, expect, it, vi } from 'vitest'
import { createQuoteStore, fetchPlans, money, planText } from '../site/pricing.js'

const plan = (overrides = {}) => ({ id: 7, productCode: 'wtm', name: 'Lifetime', planType: 'lifetime', priceFen: 2900, regularPriceFen: 8800, durationDays: null, maxDevices: 2, earlyBirdActive: true, earlyBirdEndsAt: 200, saleEndsAt: null, serverTime: 100, checkoutEnabled: true, ...overrides })
const response = (data) => ({ ok: true, json: async () => ({ code: 200, data }) })

describe('public quote contract', () => {
  it('posts only the configured product code without credentials or caching', async () => {
    const fetcher = vi.fn(async () => response([plan({ productCode: 'other' }), plan()]))
    expect(await fetchPlans({ apiBase: 'https://example.test/api/v1/', productCode: 'other' }, fetcher)).toHaveLength(1)
    expect(fetcher.mock.calls[0]).toEqual(['https://example.test/api/v1/pricing/plans/list', expect.objectContaining({ method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', body: '{"productCode":"other"}' })])
  })
  it('handles empty data, bad envelopes, edge HTML and invalid money', async () => {
    expect(await fetchPlans({ productCode: 'wtm', apiBase: '/' }, async () => response([]))).toEqual([])
    for (const value of [[], { code: 503, data: [] }, { code: 200, data: [plan({ priceFen: 2.5 })] }]) {
      await expect(fetchPlans({ productCode: 'wtm', apiBase: '/' }, async () => ({ ok: true, json: async () => value }))).rejects.toThrow()
    }
    await expect(fetchPlans({ productCode: 'wtm', apiBase: '/' }, async () => ({ ok: false, status: 403 }))).rejects.toThrow()
    expect(money(3800)).toBe('¥38')
    expect(money(3801)).toBe('¥38.01')
  })
  it('keeps prices with payment off and describes durations in both languages', async () => {
    const yearly = plan({ planType: 'yearly', durationDays: 365, priceFen: 3800, earlyBirdActive: false, earlyBirdEndsAt: null, checkoutEnabled: false })
    expect(planText(yearly, 'zh-CN')).toContain('365 天')
    expect(planText(yearly, 'en')).toContain('365 days')
    expect(planText(yearly, 'en')).not.toMatch(/[\u4e00-\u9fff]/)
    expect(planText(plan(), 'en')).toContain('Lifetime')
    const items = [yearly, plan({ id: 8, planType: 'monthly', durationDays: 30 }), plan({ id: 9, planType: 'custom', durationDays: 90 })]
    expect(await fetchPlans({ productCode: 'wtm', apiBase: '/' }, async () => response(items))).toEqual(items)
    expect(planText(items[1], 'en')).toContain('Monthly · 30 days')
    expect(planText(items[2], 'en')).toContain('Custom · 90 days')
  })
})

describe('quote freshness and explicit selection', () => {
  function setup() {
    let time = 0
    const fetcher = vi.fn(async () => response([plan(), plan({ id: 8, planType: 'yearly', durationDays: 365 })]))
    const store = createQuoteStore({ apiBase: '/', productCode: 'wtm' }, { fetcher, now: () => time })
    return { store, fetcher, advance: ms => { time += ms } }
  }
  it('requires a choice, preserves IDs after reordering and clears a removed choice', async () => {
    const { store, fetcher } = setup()
    await store.refresh()
    expect(store.selected()).toBeNull()
    store.select(8)
    fetcher.mockResolvedValueOnce(response([plan({ id: 8 }), plan()]))
    await store.refresh()
    expect(store.selected().id).toBe(8)
    fetcher.mockResolvedValueOnce(response([plan()]))
    await store.refresh()
    expect(store.selected()).toBeNull()
  })
  it('invalidates exactly at server deadline despite a different client clock', async () => {
    const { store, advance } = setup()
    await store.refresh()
    store.select(7)
    advance(99999)
    expect(store.isFresh()).toBe(true)
    advance(1)
    expect(store.isFresh()).toBe(false)
    expect(store.selected()).toBeNull()
  })
  it('clears obsolete promotions during refresh and on failure, then restores regular quotes', async () => {
    const { store, fetcher, advance } = setup()
    await store.refresh()
    store.select(7)
    advance(100000)
    fetcher.mockRejectedValueOnce(new Error('offline'))
    await store.refresh()
    expect(store.state()).toMatchObject({ status: 'error', plans: [] })
    expect(store.selected()).toBeNull()
    fetcher.mockResolvedValueOnce(response([plan({ priceFen: 8800, earlyBirdActive: false, earlyBirdEndsAt: null, serverTime: 200 })]))
    await store.refresh()
    expect(store.state().plans[0].priceFen).toBe(8800)
  })
  it('refreshes stale pages and observes an earlier whole-plan stop time', async () => {
    const { store, fetcher, advance } = setup()
    fetcher.mockResolvedValueOnce(response([plan({ earlyBirdEndsAt: 500, saleEndsAt: 110 })]))
    await store.refresh()
    advance(10000)
    expect(store.isFresh()).toBe(false)
    fetcher.mockResolvedValueOnce(response([]))
    await store.refresh()
    expect(store.state().status).toBe('empty')
  })
  it('shares in-flight requests and rejects quotes that expire during transit', async () => {
    const { store, fetcher, advance } = setup()
    let resolve
    fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const first = store.refresh()
    expect(store.refresh()).toBe(first)
    expect(fetcher).toHaveBeenCalledTimes(1)
    advance(100000)
    resolve(response([plan()]))
    await first
    expect(store.state().status).toBe('error')
    expect(store.selected()).toBeNull()
  })
})

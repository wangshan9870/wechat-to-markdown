import { afterEach, describe, expect, it, vi } from 'vitest'
import { readReceipt, receiptHash, orderView, request } from '../site/purchase/checkout.js'

afterEach(() => vi.unstubAllGlobals())

describe('purchase recovery and fulfilment', () => {
  const receipt = { productId: 1, accessToken: 'a'.repeat(64), orderNo: '' }
  it('retains the same idempotency token before an order number exists', () => {
    expect(readReceipt(receiptHash(receipt))).toEqual(receipt)
    expect(readReceipt(receiptHash({ ...receipt, orderNo: 'WX123' }))).toEqual({ ...receipt, orderNo: 'WX123' })
    expect(readReceipt('#receipt=invalid&product=1')).toBeNull()
    expect(readReceipt(receiptHash({ ...receipt, productId: -1 }))).toBeNull()
  })
  it('never exposes a code for unpaid or refunded orders', () => {
    for (const paymentStatus of ['pending', 'closed', 'refunded', 'refund_pending']) {
      expect(orderView({ paymentStatus, fulfillmentStatus: 'delivered', licenseCode: 'secret' }).license).toBeUndefined()
    }
    expect(orderView({ paymentStatus: 'paid', fulfillmentStatus: 'delivered', licenseCode: 'secret' })).toMatchObject({ done: true, license: 'secret' })
    expect(orderView({ paymentStatus: 'paid', fulfillmentStatus: 'failed' })).toMatchObject({ done: false })
  })
  it('hides expired or invalid QR while continuing to verify with the server', () => {
    expect(orderView({ paymentStatus: 'pending', expiresAt: 200 }, 199)).toMatchObject({ qr: true })
    expect(orderView({ paymentStatus: 'pending', expiresAt: 200 }, 200)).toMatchObject({ done: false })
    expect(orderView({ paymentStatus: 'pending', expiresAt: 200 }, 200).qr).toBeUndefined()
    expect(orderView({ paymentStatus: 'pending' }).qr).toBeUndefined()
    expect(orderView({ paymentStatus: 'unexpected', licenseCode: 'secret' })).toMatchObject({ done: true })
    expect(orderView({ paymentStatus: 'paid', fulfillmentStatus: 'unexpected', licenseCode: 'secret' }).license).toBeUndefined()
  })
  it('posts credentials only in request body and disables cache/referrer', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 200, data: [] }) })
    await request('orders/detail', receipt, fetcher)
    const [url, options] = fetcher.mock.calls[0]
    expect(url).not.toContain(receipt.accessToken)
    expect(options).toMatchObject({ cache: 'no-store', referrerPolicy: 'no-referrer', credentials: 'omit' })
    expect(JSON.parse(options.body)).toEqual(receipt)
  })
  it('fails closed on server errors without reflecting server content', async () => {
    await expect(request('orders/create', receipt, async () => ({ ok: true, json: async () => ({ code: 503, message: 'secret' }) }))).rejects.toThrow('订单服务暂时不可用')
  })
})

describe('English checkout status', () => {
  it('localizes every payment stage without changing fulfillment behavior', () => {
    const orders = [
      { paymentStatus: 'refund_pending' }, { paymentStatus: 'refunded' },
      { paymentStatus: 'closed' }, { paymentStatus: 'pending', expiresAt: 200 },
      { paymentStatus: 'pending', expiresAt: 1 },
      { paymentStatus: 'paid', fulfillmentStatus: 'pending' },
      { paymentStatus: 'paid', fulfillmentStatus: 'failed' },
      { paymentStatus: 'paid', fulfillmentStatus: 'delivered', licenseCode: 'test-code' },
      { paymentStatus: 'unexpected' },
    ]
    for (const order of orders) {
      vi.stubGlobal('document', { documentElement: { lang: 'zh-CN' } })
      const { title: zhTitle, message: zhMessage, ...zhState } = orderView(order, 100)
      vi.stubGlobal('document', { documentElement: { lang: 'en' } })
      const { title, message, ...enState } = orderView(order, 100)
      expect(enState).toEqual(zhState)
      expect(message).not.toMatch(/[\u4e00-\u9fff]/)
      expect(title || '').not.toMatch(/[\u4e00-\u9fff]/)
    }
  })
})

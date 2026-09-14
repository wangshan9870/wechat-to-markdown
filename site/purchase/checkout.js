const API = 'https://work.bzjkmn.cn/api/v1/store/'

export function readReceipt(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const accessToken = params.get('receipt') || ''
  const productId = Number(params.get('product'))
  const orderNo = params.get('order') || ''
  if (!/^[a-f0-9]{64}$/.test(accessToken) || !Number.isSafeInteger(productId) || productId <= 0) return null
  if (orderNo && !/^[A-Za-z0-9_-]{1,64}$/.test(orderNo)) return null
  return { accessToken, productId, orderNo }
}

export function receiptHash(receipt) {
  return '#' + new URLSearchParams({ receipt: receipt.accessToken, product: String(receipt.productId), ...(receipt.orderNo ? { order: receipt.orderNo } : {}) })
}

export function orderView(order, nowSeconds = Date.now() / 1000) {
  if (order.paymentStatus === 'refund_pending') return { message: '订单已转入退款，退款结果正在核实。如有问题，请联系人工支持。', done: true }
  if (order.paymentStatus === 'refunded') return { message: '订单已退款。如有授权问题，请联系人工支持。', done: true }
  if (order.paymentStatus === 'closed') return { message: '订单已关闭，二维码已失效。可以重新购买。', done: true, restart: true }
  if (order.paymentStatus === 'paid') {
    if (order.fulfillmentStatus === 'delivered' && order.licenseCode) return { message: '付款成功，卡密已准备好。请在扩展内激活。', done: true, license: order.licenseCode }
    if (['pending', 'failed'].includes(order.fulfillmentStatus)) return { message: order.fulfillmentStatus === 'failed' ? '已付款，发卡正在重试。请保存订单链接，无需再次付款；长时间未收到请联系人工支持。' : '已付款，正在生成卡密。关闭页面也不影响发货。', done: false }
  }
  if (order.paymentStatus === 'pending') {
    if (!Number.isFinite(order.expiresAt) || order.expiresAt <= nowSeconds) return { message: '正在核实二维码有效期与付款结果，请稍候；如已付款，无需再次购买。', done: false }
    return { message: '请用手机微信扫码付款。付款后这里会自动显示卡密。', done: false, qr: true }
  }
  return { message: '暂时无法识别订单状态，请保存订单链接并联系人工支持。', done: true }
}

export async function request(path, body, fetcher = fetch) {
  const response = await fetcher(API + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
    cache: 'no-store', referrerPolicy: 'no-referrer', body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('订单服务暂时不可用，请稍后重试或选择微信人工购买。')
  const result = await response.json()
  if (result.code !== 200) throw new Error('订单服务暂时不可用，或当前套餐已停售。请稍后重试或联系人工支持。')
  return result.data
}

if (typeof document !== 'undefined') initialize()

function initialize() {
  const status = document.getElementById('checkout-status')
  if (!status) return
  const buy = document.getElementById('checkout-buy')
  const retry = document.getElementById('checkout-retry')
  const save = document.getElementById('checkout-save')
  const qr = document.getElementById('checkout-qr')
  const card = document.getElementById('checkout-card')
  const copy = document.getElementById('checkout-copy')
  const orderLabel = document.getElementById('checkout-order')
  let receipt = readReceipt(location.hash)
  let product = null
  let timer = null
  let busy = false
  let canRestart = false

  function retain() {
    history.replaceState(null, '', location.pathname + receiptHash(receipt))
    save.hidden = false
  }

  function render(order) {
    receipt.orderNo = order.orderNo
    retain()
    const view = orderView(order)
    canRestart = Boolean(view.restart)
    status.textContent = view.message
    orderLabel.textContent = `订单 ${order.orderNo} · ${order.productName} · ¥${(order.priceFen / 100).toFixed(2)}`
    qr.hidden = true
    qr.removeAttribute('src')
    if (view.qr && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(order.qrCodeDataUrl || '')) {
      qr.src = order.qrCodeDataUrl
      qr.hidden = false
    }
    card.textContent = view.license || ''
    card.hidden = !view.license
    copy.hidden = !view.license
    buy.hidden = !view.restart
    buy.textContent = '重新购买'
    buy.disabled = !product || !canRestart
    if (!view.done) timer = setTimeout(loadOrder, 4000)
  }

  async function loadOrder() {
    if (busy || !receipt) return
    clearTimeout(timer)
    busy = true
    retry.hidden = true
    buy.disabled = true
    try {
      const order = receipt.orderNo
        ? await request('orders/detail', { orderNo: receipt.orderNo, accessToken: receipt.accessToken })
        : await request('orders/create', { productId: receipt.productId, accessToken: receipt.accessToken })
      render(order)
    } catch {
      status.textContent = '暂时无法确认订单结果。请保存订单链接后重试；如果已付款，请勿重复购买。'
      retry.hidden = false
      qr.hidden = true
    } finally { busy = false }
  }

  buy.addEventListener('click', () => {
    if (!product || busy || (receipt && !canRestart)) return
    clearTimeout(timer)
    canRestart = false
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    receipt = { productId: product.id, accessToken: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''), orderNo: '' }
    retain()
    buy.hidden = true
    status.textContent = '正在创建支付订单…'
    loadOrder()
  })
  retry.addEventListener('click', () => receipt ? loadOrder() : loadProducts())
  window.addEventListener('hashchange', () => {
    const next = readReceipt(location.hash)
    // A fresh document owns the new receipt; old in-flight requests cannot overwrite it.
    if (next && (!receipt || receiptHash(next) !== receiptHash(receipt))) location.reload()
  })
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href^="#"]')
    if (!receipt || !link) return
    const target = document.getElementById(link.getAttribute('href').slice(1))
    if (target) { event.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }) }
  })
  save.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.origin + location.pathname + receiptHash(receipt)); save.textContent = '订单链接已复制，请妥善保存' }
    catch { save.textContent = '请复制地址栏中的完整链接保存' }
  })
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(card.textContent); copy.textContent = '卡密已复制' }
    catch { copy.textContent = '复制失败，请选中上方卡密手动复制' }
  })
  async function loadProducts() {
    try {
      const products = await request('products/list', { productCode: 'wtm' })
      product = products.find(item => item.active && item.productCode === 'wtm')
      if (receipt && canRestart && !busy) buy.disabled = !product
      if (!receipt) {
        status.textContent = product ? `${product.name} · ${product.maxDevices} 台设备${product.durationDays == null ? ' · 永久授权' : ` · ${product.durationDays} 天`}` : '当前暂无可在线购买的套餐，请联系微信人工支持。'
        buy.disabled = !product
        buy.textContent = product ? `微信扫码购买 · ¥${(product.priceFen / 100).toFixed(2)}` : '暂未开放在线购买'
        retry.hidden = true
      }
    } catch {
      if (!receipt) { status.textContent = '在线支付暂未开放或服务不可用，可选择下方微信人工购买。'; retry.hidden = false }
    }
  }
  loadProducts()
  if (receipt) { retain(); buy.hidden = true; loadOrder() }
}

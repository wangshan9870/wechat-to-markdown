import { websiteAnalytics } from '../website-analytics.js'
const english = () => typeof document !== 'undefined' && document.documentElement.lang === 'en'
const englishMessages = {
  "订单已转入退款，退款结果正在核实。如有问题，请联系人工支持。": "A refund is being verified. Contact support if you need help.",
  "订单已退款。如有授权问题，请联系人工支持。": "This order has been refunded. Contact support for licensing issues.",
  "订单已关闭，二维码已失效。可以重新购买。": "This order is closed and its QR code has expired. You can start a new purchase.",
  "购买成功，你的卡密已生成": "Purchase complete. Your license code is ready.",
  "点击下方按钮复制卡密，再到扩展内激活。": "Copy the code below, then activate it inside the extension.",
  "付款成功，正在生成你的卡密…": "Payment received. Preparing your license code…",
  "已付款，发卡正在重试。请保存订单链接，无需再次付款；长时间未收到请联系人工支持。": "Payment received; code delivery is being retried. Save the order link and do not pay again. Contact support if delivery remains pending.",
  "已收到付款，卡密将在当前区域显示。请稍候，无需再次付款。": "Payment received. Your code will appear here. Please wait and do not pay again.",
  "正在确认付款结果": "Checking payment status",
  "正在核实二维码有效期与付款结果，请稍候；如已付款，无需再次购买。": "Checking QR validity and payment status. Please wait; if you have paid, do not buy again.",
  "付款后，卡密会自动显示在这里": "Your code will appear here after payment",
  "用手机微信扫描下方二维码，付款后请回到此电脑页面领取卡密。": "Scan with WeChat on your phone, then return to this computer page to collect your code.",
  "暂时无法识别订单状态，请保存订单链接并联系人工支持。": "Unable to identify the order status. Save the order link and contact support.",
  "订单服务暂时不可用，请稍后重试或选择微信人工购买。": "The order service is unavailable. Try again later or buy with WeChat support.",
  "订单服务暂时不可用，或当前套餐已停售。请稍后重试或联系人工支持。": "The order service is unavailable or this plan is no longer on sale. Try later or contact support.",
  "订单状态": "Order status",
  "我已付款，查询卡密": "I have paid — check my code",
  "刷新领取结果": "Refresh delivery status",
  "重新购买": "Start a new purchase",
  "暂时无法确认订单结果。请保存订单链接后重试；如果已付款，请勿重复购买。": "Unable to confirm the order. Save its link and retry. If you have paid, do not buy again.",
  "重新查询付款与卡密": "Check payment and code again",
  "正在创建支付订单…": "Creating payment order…",
  "订单链接已复制，请妥善保存": "Order link copied. Keep it private.",
  "请复制地址栏中的完整链接保存": "Copy and save the complete link from your address bar.",
  "卡密已复制": "License code copied",
  "复制失败，请选中上方卡密手动复制": "Copy failed. Select and copy the code above manually.",
  " · 永久授权": " · Lifetime license",
  "当前暂无可在线购买的套餐，请联系微信人工支持。": "No plan is currently available online. Contact WeChat support.",
  "暂未开放在线购买": "Online checkout unavailable",
  "在线支付暂未开放或服务不可用，可选择下方微信人工购买。": "Online payment is unavailable. Use the manual WeChat purchase option below."
}
function text(message) { return english() ? (englishMessages[message] || message) : message }

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
  if (order.paymentStatus === 'refund_pending') return { message: text("订单已转入退款，退款结果正在核实。如有问题，请联系人工支持。"), done: true }
  if (order.paymentStatus === 'refunded') return { message: text("订单已退款。如有授权问题，请联系人工支持。"), done: true }
  if (order.paymentStatus === 'closed') return { message: text("订单已关闭，二维码已失效。可以重新购买。"), done: true, restart: true }
  if (order.paymentStatus === 'paid') {
    if (order.fulfillmentStatus === 'delivered' && order.licenseCode) return { stage: 'delivered', title: text("购买成功，你的卡密已生成"), message: text("点击下方按钮复制卡密，再到扩展内激活。"), done: true, license: order.licenseCode }
    if (['pending', 'failed'].includes(order.fulfillmentStatus)) return { stage: 'paid', title: text("付款成功，正在生成你的卡密…"), message: order.fulfillmentStatus === 'failed' ? text("已付款，发卡正在重试。请保存订单链接，无需再次付款；长时间未收到请联系人工支持。") : text("已收到付款，卡密将在当前区域显示。请稍候，无需再次付款。"), done: false }
  }
  if (order.paymentStatus === 'pending') {
    if (!Number.isFinite(order.expiresAt) || order.expiresAt <= nowSeconds) return { stage: 'checking', title: text("正在确认付款结果"), message: text("正在核实二维码有效期与付款结果，请稍候；如已付款，无需再次购买。"), done: false }
    return { stage: 'pending', title: text("付款后，卡密会自动显示在这里"), message: text("用手机微信扫描下方二维码，付款后请回到此电脑页面领取卡密。"), done: false, qr: true }
  }
  return { message: text("暂时无法识别订单状态，请保存订单链接并联系人工支持。"), done: true }
}

export async function request(path, body, fetcher = fetch) {
  const response = await fetcher(API + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
    cache: 'no-store', referrerPolicy: 'no-referrer', body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(text("订单服务暂时不可用，请稍后重试或选择微信人工购买。"))
  const result = await response.json()
  if (result.code !== 200) throw new Error(text("订单服务暂时不可用，或当前套餐已停售。请稍后重试或联系人工支持。"))
  return result.data
}

if (typeof document !== 'undefined') initialize()

function initialize() {
  const status = document.getElementById('checkout-status')
  if (!status) return
  const progress = document.getElementById('checkout-progress')
  const title = document.getElementById('checkout-title')
  const delivery = document.getElementById('checkout-delivery')
  const locationHint = document.getElementById('checkout-location')
  let previousStage = ''
  const buy = document.getElementById('checkout-buy')
  const retry = document.getElementById('checkout-retry')
  const save = document.getElementById('checkout-save')
  const qr = document.getElementById('checkout-qr')
  const card = document.getElementById('checkout-card')
  const copy = document.getElementById('checkout-copy')
  const orderLabel = document.getElementById('checkout-order')
  let receipt = readReceipt(location.hash)
  // Only a newly generated capability receives its original, consented snapshot.
  // A restored capability never borrows attribution from the current visit.
  let orderAttribution = null
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
    if (status.textContent !== view.message) status.textContent = view.message
    title.textContent = view.title || text("订单状态")
    progress.dataset.stage = view.stage || 'other'
    locationHint.hidden = !view.qr
    delivery.hidden = !view.license
    retry.hidden = Boolean(view.done)
    retry.textContent = view.qr ? text("我已付款，查询卡密") : text("刷新领取结果")
    if (view.stage && previousStage !== view.stage) {
      if (['pending', 'paid', 'delivered'].includes(view.stage)) {
        progress.focus({ preventScroll: true })
        progress.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
      }
      previousStage = view.stage
    }
    orderLabel.textContent = `${english() ? 'Order' : '订单'} ${order.orderNo} · ${english() ? 'WeChat to Markdown' : order.productName} · ¥${(order.priceFen / 100).toFixed(2)}`
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
    buy.textContent = text("重新购买")
    buy.disabled = !product || !canRestart
    if (!view.done) timer = setTimeout(loadOrder, 4000)
  }

  async function loadOrder() {
    if (busy || !receipt) return
    clearTimeout(timer)
    busy = true
    retry.disabled = true
    buy.disabled = true
    try {
      const order = receipt.orderNo
        ? await request('orders/detail', { orderNo: receipt.orderNo, accessToken: receipt.accessToken })
        : await request('orders/create', { productId: receipt.productId, accessToken: receipt.accessToken, ...(orderAttribution && websiteAnalytics?.orderAttribution() ? { attribution: orderAttribution } : {}) })
      render(order)
    } catch {
      status.textContent = text("暂时无法确认订单结果。请保存订单链接后重试；如果已付款，请勿重复购买。")
      retry.hidden = false
      retry.textContent = text("重新查询付款与卡密")
      qr.hidden = true
      timer = setTimeout(loadOrder, 8000)
    } finally { busy = false; retry.disabled = false }
  }

  buy.addEventListener('click', () => {
    if (!product || busy || (receipt && !canRestart)) return
    clearTimeout(timer)
    canRestart = false
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    orderAttribution = websiteAnalytics?.orderAttribution() || null
    websiteAnalytics?.event('website_purchase_clicked')
    receipt = { productId: product.id, accessToken: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''), orderNo: '' }
    retain()
    buy.hidden = true
    status.textContent = text("正在创建支付订单…")
    loadOrder()
  })
  document.addEventListener('visibilitychange', () => { if (!document.hidden && receipt && !card.textContent) loadOrder() })
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
    try { await navigator.clipboard.writeText(location.origin + location.pathname + receiptHash(receipt)); save.textContent = text("订单链接已复制，请妥善保存") }
    catch { save.textContent = text("请复制地址栏中的完整链接保存") }
  })
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(card.textContent); copy.textContent = text("卡密已复制") }
    catch { copy.textContent = text("复制失败，请选中上方卡密手动复制") }
  })
  async function loadProducts() {
    try {
      const products = await request('products/list', { productCode: 'wtm' })
      product = products.find(item => item.active && item.productCode === 'wtm')
      if (receipt && canRestart && !busy) buy.disabled = !product
      if (!receipt) {
        status.textContent = product ? `${english() ? 'WeChat to Markdown' : product.name} · ${product.maxDevices} ${english() ? 'devices' : '台设备'}${product.durationDays == null ? text(' · 永久授权') : ` · ${product.durationDays} ${english() ? 'days' : '天'}`}` : text("当前暂无可在线购买的套餐，请联系微信人工支持。")
        buy.disabled = !product
        buy.textContent = product ? `${english() ? 'Buy with WeChat Pay' : '微信扫码购买'} · ¥${(product.priceFen / 100).toFixed(2)}` : text("暂未开放在线购买")
        retry.hidden = true
      }
    } catch {
      if (!receipt) { status.textContent = text("在线支付暂未开放或服务不可用，可选择下方微信人工购买。"); retry.hidden = false }
    }
  }
  loadProducts()
  if (receipt) { retain(); buy.hidden = true; loadOrder() }
}

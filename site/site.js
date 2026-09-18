(() => {
  const allowedEvents = new Set([
    'install_cta_clicked',
    'pricing_cta_clicked',
    'support_clicked',
  ])
  const allowedPurchaseSurfaces = new Set([
    'reader_panel',
    'album_panel',
    'library',
    'generic_panel',
    'welcome',
  ])
  const purchaseContextMessages = {
    manual_click: '你从扩展的“解锁完整版”入口来到这里。先看清免费版与永久版的区别，再选择购买方式。',
    quota_limit: '当前免费额度已用完。免费版每月 10 次单篇导出；早鸟永久版永久不限导出次数。',
    batch_export: '你刚才使用了批量导出入口。永久版支持在本地文章库中筛选、整理并批量导出。',
    zip_download: '你刚才尝试下载完整归档包。永久版支持合集分卷、断点继续和增量归档。',
    library_locked: '本地文章库的阅读、归档、搜索和手动备份不消耗额度；永久版提供批量导出与知识库联动。',
    trial_used: '一次免费合集试用已经完成。永久版可继续完整、增量归档公众号合集。',
    post_success: '单篇文章已经保存成功。需要持续整理合集和本地文章库时，再考虑永久版。',
  }
  const config = window.WX2MD_SITE_CONFIG || {}
  const measurementId = typeof config.ga4MeasurementId === 'string'
    ? config.ga4MeasurementId.trim()
    : ''
  const analyticsConfigured = /^G-[A-Z0-9]+$/.test(measurementId)
  const pagePath = window.location.pathname
  const contentCluster = document.body.dataset.contentCluster || 'product'
  const purchaseSource = readPurchaseSource()

  let analyticsReady = false

  document.documentElement.classList.add('js')
  showPurchaseContext()
  bindTrackedLinks()
  setupAnalyticsChoice()

  function setupAnalyticsChoice() {
    if (pagePath === '/purchase/' || pagePath === '/purchase' || !analyticsConfigured) return
    const key = 'wx2md:analytics-choice-v1'
    let choice = ''
    try { choice = window.localStorage.getItem(key) || '' } catch { /* Default: no tracking. */ }
    const panel = document.createElement('section')
    panel.className = 'analytics-choice'
    const english = document.documentElement.lang === 'en'
    panel.setAttribute('aria-label', english ? 'Optional website analytics' : '可选网站统计')
    panel.innerHTML = english
      ? '<p>Allow optional website analytics? Declining does not affect installation or use. <a href="/privacy/#analytics">Privacy details (Chinese)</a></p><div><button type="button" data-choice="granted">Allow analytics</button><button type="button" data-choice="denied">Decline / withdraw</button></div>'
      : '<p>允许可选访问统计？仅用于改进官网；拒绝不影响安装与使用。<a href="/privacy/#analytics">了解详情</a></p><div><button type="button" data-choice="granted">允许统计</button><button type="button" data-choice="denied">拒绝 / 撤回</button></div>'
    const settings = document.createElement('button')
    settings.type = 'button'
    settings.className = 'analytics-settings'
    settings.textContent = english ? 'Analytics settings' : '网站统计设置'
    settings.addEventListener('click', () => { panel.hidden = false; panel.querySelector('button').focus() })
    panel.hidden = Boolean(choice)
    panel.addEventListener('click', (event) => {
      const button = event.target.closest('[data-choice]')
      if (!button) return
      const next = button.dataset.choice
      try { window.localStorage.setItem(key, next) } catch { /* Choice still applies this page. */ }
      if (next === 'granted') enableAnalytics()
      else {
        window[`ga-disable-${measurementId}`] = true
        analyticsReady = false
        for (const cookie of document.cookie.split(';')) {
          const name = cookie.trim().split('=')[0]
          if (!/^_ga(?:_|$)/.test(name)) continue
          for (const domain of ['', `; domain=${window.location.hostname}`, '; domain=.wx2md.com']) {
            document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`
          }
        }
      }
      panel.hidden = true
      settings.focus()
    })
    document.body.append(panel, settings)
    if (choice === 'granted') enableAnalytics()
  }

  function readPurchaseSource() {
    if (pagePath !== '/purchase/' && pagePath !== '/purchase') return {}

    const searchParams = new URLSearchParams(window.location.search)
    const surfaceCandidate = searchParams.get('surface') || ''
    const triggerCandidate = searchParams.get('trigger') || ''
    return {
      ...(allowedPurchaseSurfaces.has(surfaceCandidate) ? { surface: surfaceCandidate } : {}),
      ...(Object.hasOwn(purchaseContextMessages, triggerCandidate) ? { trigger: triggerCandidate } : {}),
    }
  }

  function showPurchaseContext() {
    if (!purchaseSource.trigger) return
    const context = document.getElementById('purchase-context')
    if (!(context instanceof HTMLElement)) return

    context.textContent = purchaseContextMessages[purchaseSource.trigger]
    context.hidden = false
  }

  function sourceParameters() {
    return {
      ...(purchaseSource.surface ? { source_surface: purchaseSource.surface } : {}),
      ...(purchaseSource.trigger ? { source_trigger: purchaseSource.trigger } : {}),
    }
  }

  function bindTrackedLinks() {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target.closest('[data-track-event]')
        : null
      if (!(target instanceof HTMLElement)) return

      const eventName = target.dataset.trackEvent || ''
      if (!allowedEvents.has(eventName)) return

      sendEvent(eventName, {
        page_path: pagePath,
        placement: target.dataset.trackPlacement || 'content',
        target: target.dataset.trackTarget || 'internal',
      })
    })
  }

  function enableAnalytics() {
    // Payment receipts and delivered codes must never be exposed to third-party scripts.
    if (pagePath === '/purchase/' || pagePath === '/purchase') return
    if (!analyticsConfigured || analyticsReady) return
    window[`ga-disable-${measurementId}`] = false

    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: `${window.location.origin}${pagePath}`,
      page_referrer: '',
    })

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    document.head.append(script)
    analyticsReady = true

    window.gtag('event', 'page_view', {
      page_location: `${window.location.origin}${pagePath}`,
      page_path: pagePath,
      page_title: document.title,
      content_cluster: contentCluster,
      ...sourceParameters(),
      transport_type: 'beacon',
    })
  }

  function sendEvent(eventName, parameters) {
    if (!analyticsReady || typeof window.gtag !== 'function') return
    window.gtag('event', eventName, {
      ...parameters,
      content_cluster: contentCluster,
      ...sourceParameters(),
      transport_type: 'beacon',
    })
  }
})()

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
    quota_limit: '当前免费额度已达到限制。永久版会解锁完整归档能力；单篇文章导出仍然长期免费。',
    batch_export: '你刚才使用了批量导出入口。永久版支持在本地文章库中筛选、整理并批量导出。',
    zip_download: '你刚才尝试下载完整归档包。永久版支持合集分卷、断点继续和增量归档。',
    library_locked: '本地文章库的进阶管理需要永久版：筛选、归档合集和批量导出都包含在内。',
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
  enableAnalytics()

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
    if (!analyticsConfigured || analyticsReady) return

    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
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

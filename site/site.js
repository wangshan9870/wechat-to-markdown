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
    manual_click: '你从扩展的“解锁完整版”入口来到这里。先看清免费版与付费套餐的区别，再选择购买方式。',
    quota_limit: '当前免费额度已用完。免费版每月 10 次单篇导出；付费套餐在授权期内不限导出次数。',
    batch_export: '你刚才使用了批量导出入口。付费套餐支持在本地文章库中筛选、整理并批量导出。',
    zip_download: '你刚才尝试下载完整归档包。付费套餐支持合集分卷、断点继续和增量归档。',
    library_locked: '本地文章库的阅读、归档、搜索和手动备份不消耗额度；付费套餐提供批量导出与知识库联动。',
    trial_used: '一次免费合集试用已经完成。付费套餐可继续完整、增量归档公众号合集。',
    post_success: '单篇文章已经保存成功。需要持续整理合集和本地文章库时，再考虑付费套餐。',
  }
  const config = window.WX2MD_SITE_CONFIG || {}
  const measurementId = typeof config.ga4MeasurementId === 'string'
    ? config.ga4MeasurementId.trim()
    : ''
  const analyticsConfigured = /^G-[A-Z0-9]+$/.test(measurementId)
  const pagePath = window.location.pathname
  const englishPage = document.documentElement.lang === 'en'
  const purchasePage = /^\/(?:en\/)?purchase(?:\/|\/index\.html)?$/.test(pagePath)
  const contentCluster = document.body.dataset.contentCluster || 'product'
  const purchaseSource = readPurchaseSource()

  let analyticsReady = false
  let choiceRevision = 0
  let firstParty = null
  const firstPartyConfigured = Boolean(config.websiteAnalytics)
  function setFirstPartyConsent(choice) {
    const revision = ++choiceRevision
    if (!firstPartyConfigured) return
    if (firstParty) firstParty.setConsent(choice)
    else import('./website-analytics.js').then(({ websiteAnalytics }) => {
      if (revision !== choiceRevision) return
      firstParty = websiteAnalytics
      firstParty?.setConsent(choice)
    }).catch(() => {})
  }

  document.documentElement.classList.add('js')
  showPurchaseContext()
  bindTrackedLinks()
  const languageSwitch = document.querySelector('.language-switch')
  if (purchasePage && languageSwitch) {
    function syncLanguageReceipt() {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const receipt = params.get('receipt') || ''
      const product = params.get('product') || ''
      const order = params.get('order') || ''
      const valid = /^[a-f0-9]{64}$/.test(receipt) && /^[1-9]\d*$/.test(product)
        && Number.isSafeInteger(Number(product)) && (!order || /^[A-Za-z0-9_-]{1,64}$/.test(order))
      const clean = valid ? new URLSearchParams({ receipt, product, ...(order ? { order } : {}) }).toString() : ''
      languageSwitch.hash = clean
    }
    syncLanguageReceipt()
    languageSwitch.addEventListener('click', syncLanguageReceipt)
    window.addEventListener('hashchange', syncLanguageReceipt)
  }
  setupAnalyticsChoice()

  function setupAnalyticsChoice() {
    if (!firstPartyConfigured && (purchasePage || !analyticsConfigured)) return
    const key = config.websiteAnalytics?.consentKey || 'wx2md:analytics-choice-v1'
    let choice = ''
    try { choice = window.localStorage.getItem(key) || '' } catch { /* Default: no tracking. */ }
    const panel = document.createElement('section')
    panel.className = 'analytics-choice'
    const english = document.documentElement.lang === 'en'
    panel.setAttribute('aria-label', english ? 'Optional website analytics' : '可选网站统计')
    panel.innerHTML = english
      ? '<p>Allow optional visit and source statistics? NAS Work receives coarse source, browser and device categories; other pages may also use Google Analytics. Declining does not affect purchases or use. <a href="/en/privacy/#analytics">Privacy details</a></p><div><button type="button" data-choice="granted">Allow analytics</button><button type="button" data-choice="denied">Decline / withdraw</button></div>'
      : '<p>允许可选访问与来源统计？NAS Work 接收渠道、浏览器和设备类别；非购买页还会使用 Google 统计。拒绝不影响购买与使用。<a href="/privacy/#analytics">了解详情</a></p><div><button type="button" data-choice="granted">允许统计</button><button type="button" data-choice="denied">拒绝 / 撤回</button></div>'
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
      setFirstPartyConsent(next)
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
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return
      if (event.newValue !== 'granted') {
        setFirstPartyConsent('denied')
        window[`ga-disable-${measurementId}`] = true
        analyticsReady = false
      }
    })
    document.body.append(panel, settings)
    setFirstPartyConsent(choice)
    if (choice === 'granted') enableAnalytics()
  }

  function readPurchaseSource() {
    if (!purchasePage) return {}

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

    context.textContent = englishPage ? {
      "manual_click": "You opened the full-version page from the extension. Compare plans and choose how to buy.",
      "quota_limit": "Your free allowance is used up. The free plan includes 10 single-article exports monthly; paid plans include unlimited exports during their license period.",
      "batch_export": "You opened batch export. The full version supports filtering, organizing and exporting multiple library articles.",
      "zip_download": "You requested a complete archive. The full version supports split collection archives, resume and incremental exports.",
      "library_locked": "Reading, archiving, search and manual backups use no allowance. The full version adds batch exports and knowledge-base integrations.",
      "trial_used": "Your free collection trial is complete. The full version supports complete and incremental collection archives.",
      "post_success": "Your article was saved. Consider the full version if you need ongoing collection and library management."
    }[purchaseSource.trigger] : purchaseContextMessages[purchaseSource.trigger]
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

      if (eventName === 'pricing_cta_clicked') firstParty?.event('website_purchase_clicked')
      sendEvent(eventName, {
        page_path: pagePath,
        placement: target.dataset.trackPlacement || 'content',
        target: target.dataset.trackTarget || 'internal',
      })
    })
  }

  function enableAnalytics() {
    // Payment receipts and delivered codes must never be exposed to third-party scripts.
    if (purchasePage) return
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

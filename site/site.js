(() => {
  const consentKey = 'wx2md:analytics-consent:v1'
  const allowedEvents = new Set([
    'install_cta_clicked',
    'pricing_cta_clicked',
    'support_clicked',
  ])
  const config = window.WX2MD_SITE_CONFIG || {}
  const measurementId = typeof config.ga4MeasurementId === 'string'
    ? config.ga4MeasurementId.trim()
    : ''
  const analyticsConfigured = /^G-[A-Z0-9]+$/.test(measurementId)
  const pagePath = window.location.pathname
  const contentCluster = document.body.dataset.contentCluster || 'product'

  let analyticsReady = false
  let consentPanel = null

  document.documentElement.classList.add('js')
  bindTrackedLinks()
  bindConsentSettings()

  const savedConsent = readConsent()
  if (savedConsent === 'granted') {
    enableAnalytics(false)
  } else if (savedConsent !== 'denied') {
    showConsentPanel()
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

  function bindConsentSettings() {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target.closest('[data-open-privacy-settings]')
        : null
      if (!target) return
      event.preventDefault()
      showConsentPanel(true)
    })
  }

  function showConsentPanel(force = false) {
    if (consentPanel) {
      consentPanel.hidden = false
      consentPanel.querySelector('button')?.focus()
      return
    }
    if (!force && readConsent()) return

    consentPanel = document.createElement('aside')
    consentPanel.className = 'consent-panel'
    consentPanel.setAttribute('aria-label', '网站统计设置')
    consentPanel.setAttribute('role', 'dialog')
    consentPanel.innerHTML = `
      <div>
        <strong>是否允许匿名网站统计？</strong>
        <p>同意后才会加载 GA4，用于了解哪些页面带来安装点击。不记录文章、搜索词、表单内容或完整网址。</p>
      </div>
      <div class="consent-actions">
        <button class="text-button" type="button" data-consent="denied">暂不允许</button>
        <button class="button button-small" type="button" data-consent="granted">允许匿名统计</button>
      </div>`
    document.body.append(consentPanel)

    consentPanel.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('[data-consent]')
        : null
      if (!(button instanceof HTMLButtonElement)) return
      const value = button.dataset.consent
      if (value !== 'granted' && value !== 'denied') return

      try {
        window.localStorage.setItem(consentKey, value)
      } catch {
        // 浏览器禁止本地存储时仍尊重本次选择，但下次访问会再次询问。
      }
      consentPanel.hidden = true
      if (value === 'granted') enableAnalytics(true)
    })
  }

  function readConsent() {
    try {
      const value = window.localStorage.getItem(consentKey)
      return value === 'granted' || value === 'denied' ? value : ''
    } catch {
      return ''
    }
  }

  function enableAnalytics(reportConsent) {
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
      transport_type: 'beacon',
    })

    if (reportConsent) {
      window.gtag('event', 'analytics_consent_granted', {
        consent_version: 'v1',
        transport_type: 'beacon',
      })
    }
  }

  function sendEvent(eventName, parameters) {
    if (!analyticsReady || typeof window.gtag !== 'function') return
    window.gtag('event', eventName, {
      ...parameters,
      content_cluster: contentCluster,
      transport_type: 'beacon',
    })
  }
})()

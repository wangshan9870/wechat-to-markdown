(() => {
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

  document.documentElement.classList.add('js')
  bindTrackedLinks()
  enableAnalytics()

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
      transport_type: 'beacon',
    })

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

import { readdir, readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

const siteDir = resolve('site')
const canonicalOrigin = 'https://wx2md.com'
const chromeStoreId = 'kbijkembfnijlgpkeofanhpoaefkddim'
const purchaseUrl = 'https://wangshanai.website/item/50'
const offlineDownloadPath = '/downloads/wechat-to-markdown-3.0.5.zip'
const wechatQrPath = '/assets/wechat.jpg'
const wechatRemarks = ['wx2md 会员开通', 'wx2md 定价建议', 'wx2md 产品支持']
const earlyBirdPrice = '29'
const earlyBirdEndDate = '2026-10-01'
const earlyBirdDeadlineText = '2026 年 10 月 1 日 23:59（北京时间）'
const expectedNavigation = [
  { label: '功能', href: '/#features' },
  { label: '价格', href: '/purchase/' },
  { label: '使用教程', href: '/wechat-to-markdown/' },
  { label: '支持', href: '/support/' },
  { label: '免费安装', href: '/download/' },
]
const expectedCurrentNavigation = new Map([
  ['start/index.html', '使用教程'],
  ['wechat-to-markdown/index.html', '使用教程'],
  ['wechat-collection/index.html', '使用教程'],
  ['wechat-to-obsidian/index.html', '使用教程'],
  ['download/index.html', '免费安装'],
  ['offline-install/index.html', '免费安装'],
  ['purchase/index.html', '价格'],
  ['support/index.html', '支持'],
])
const expectedCanonicalPaths = new Map([
  ['index.html', '/'],
  ['start/index.html', '/start/'],
  ['wechat-to-markdown/index.html', '/wechat-to-markdown/'],
  ['wechat-collection/index.html', '/wechat-collection/'],
  ['wechat-to-obsidian/index.html', '/wechat-to-obsidian/'],
  ['download/index.html', '/download/'],
  ['offline-install/index.html', '/offline-install/'],
  ['purchase/index.html', '/purchase/'],
  ['support/index.html', '/support/'],
  ['privacy/index.html', '/privacy/'],
])
const legacyActivationCopy = [
  /卡密只应[^。；！？\n]{0,80}本地文章库/,
  /回到(?:已安装的)?扩展(?:的)?本地文章库(?:中)?激活/,
]

const files = await walk(siteDir)
const htmlFiles = files.filter((file) => extname(file) === '.html')
const errors = []
const titles = new Map()
const canonicalUrls = new Set()

for (const file of htmlFiles) {
  const relativePath = slash(relative(siteDir, file))
  const html = await readFile(file, 'utf8')
  const title = matchOne(html, /<title>([\s\S]*?)<\/title>/gi, `${relativePath}: title`)
  const descriptions = matchAll(html, /<meta\s+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/gi)
  const h1s = matchAll(html, /<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/gi)

  if (!title) errors.push(`${relativePath}: 缺少 title`)
  if (descriptions.length !== 1) errors.push(`${relativePath}: description 必须且只能有一个`)
  if (h1s.length !== 1) errors.push(`${relativePath}: H1 必须且只能有一个`)
  validateVisualSystem(html, relativePath)
  validateLegacyBrandSubtitle(html, relativePath)
  validateActivationCopy(html, relativePath)
  if (title) {
    if (titles.has(title)) errors.push(`${relativePath}: title 与 ${titles.get(title)} 重复`)
    titles.set(title, relativePath)
  }

  if (relativePath !== '404.html') {
    const canonical = matchOne(html, /<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/gi, `${relativePath}: canonical`)
    const expectedPath = expectedCanonicalPaths.get(relativePath)
    const expectedCanonical = expectedPath ? `${canonicalOrigin}${expectedPath}` : ''
    if (!expectedPath) errors.push(`${relativePath}: 页面未登记到正式 URL 清单`)
    if (canonical !== expectedCanonical) errors.push(`${relativePath}: canonical 应为 ${expectedCanonical}`)
    if (canonical) canonicalUrls.add(canonical)
    if (/noindex/i.test(html)) errors.push(`${relativePath}: 正式页面不得包含 noindex`)
    for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
      if (!new RegExp(`<meta\\s+property=["']${property}["']`, 'i').test(html)) errors.push(`${relativePath}: 缺少 ${property}`)
    }
    if (!html.includes('/site-config.js') || !html.includes('/site.js')) errors.push(`${relativePath}: 缺少网站统计脚本入口`)
    validateBrandIdentity(html, relativePath)
    validatePrimaryNavigation(html, relativePath)
  } else if (!/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) {
    errors.push('404.html: 必须设置 noindex')
  }

  for (const target of internalTargets(html)) {
    if (!await targetExists(target)) errors.push(`${relativePath}: 内部链接或资源不存在 ${target}`)
  }
}

const sitemap = await readFile(join(siteDir, 'sitemap.xml'), 'utf8')
const sitemapUrls = new Set(matchAll(sitemap, /<loc>([^<]+)<\/loc>/g))
for (const canonical of canonicalUrls) {
  if (!sitemapUrls.has(canonical)) errors.push(`sitemap.xml: 缺少 ${canonical}`)
}
for (const url of sitemapUrls) {
  if (!canonicalUrls.has(url)) errors.push(`sitemap.xml: 包含未登记或不可索引地址 ${url}`)
}

const home = await readFile(join(siteDir, 'index.html'), 'utf8')
const jsonLdText = matchOne(home, /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi, 'index.html: JSON-LD')
if (!jsonLdText) {
  errors.push('index.html: 缺少 SoftwareApplication JSON-LD')
} else {
  try {
    const jsonLd = JSON.parse(jsonLdText)
    if (jsonLd['@type'] !== 'SoftwareApplication') errors.push('index.html: JSON-LD 类型必须是 SoftwareApplication')
    if (jsonLd.url !== `${canonicalOrigin}/`) errors.push('index.html: JSON-LD URL 不正确')
    const earlyBirdOffer = jsonLd.offers?.find((offer) => offer.name === '早鸟永久版')
    if (!earlyBirdOffer) errors.push('index.html: JSON-LD 缺少早鸟永久版 Offer')
    if (String(earlyBirdOffer?.price) !== earlyBirdPrice) errors.push(`index.html: 早鸟永久版价格必须为 ¥${earlyBirdPrice}`)
    if (earlyBirdOffer?.priceValidUntil !== earlyBirdEndDate) errors.push(`index.html: 早鸟永久版 priceValidUntil 必须为 ${earlyBirdEndDate}`)
  } catch (error) {
    errors.push(`index.html: JSON-LD 无法解析：${error instanceof Error ? error.message : String(error)}`)
  }
}

const allText = (await Promise.all(files
  .filter((file) => ['.html', '.js', '.css', '.xml', '.txt'].includes(extname(file)))
  .map((file) => readFile(file, 'utf8')))).join('\n')
for (const forbidden of [
  'WTM_GA4_API_SECRET',
  '/mp/collect',
  'api_secret=',
  'data-open-privacy-settings',
  'consent-panel',
  'analytics_consent_granted',
  'wx2md:analytics-consent',
]) {
  if (allText.includes(forbidden)) errors.push(`站点文件包含禁止配置：${forbidden}`)
}
if (!allText.includes(chromeStoreId)) errors.push('站点缺少固定 Chrome Web Store 扩展 ID')
if (!allText.includes(purchaseUrl)) errors.push('站点缺少统一在线购买地址')
if (!allText.includes(offlineDownloadPath)) errors.push('站点缺少本站官方离线版下载地址')
const purchasePage = await readFile(join(siteDir, 'purchase', 'index.html'), 'utf8')
if (!purchasePage.includes(wechatQrPath)) errors.push('购买页缺少本站微信二维码')
for (const remark of wechatRemarks.slice(0, 2)) {
  if (!purchasePage.includes(remark)) errors.push(`购买页缺少微信渠道备注：${remark}`)
}
for (const [name, html] of [['首页', home], ['购买页', purchasePage]]) {
  if (!html.includes('早鸟永久')) errors.push(`${name}缺少早鸟永久价说明`)
  if (!html.includes(earlyBirdDeadlineText)) errors.push(`${name}缺少完整的北京时间截止说明`)
  if (!html.includes('永久保留')) errors.push(`${name}缺少已购权益永久保留说明`)
}
for (const requiredText of [
  '单篇图片本地化',
  '试用 1 次',
  '最多导出 5 篇',
  '完整、增量、分卷、断点继续',
  '筛选、归档合集、批量导出',
  'Obsidian + 本机思源',
  '最多 2 台',
  '为什么现在提供永久价',
  '官网不接收卡密',
]) {
  if (!purchasePage.includes(requiredText)) errors.push(`购买页缺少关键权益或激活说明：${requiredText}`)
}
if (/<(?:form|input|textarea)\b/i.test(purchasePage)) errors.push('购买页不得提供卡密或其他表单输入')

const startPage = await readFile(join(siteDir, 'start', 'index.html'), 'utf8')
for (const requiredText of ['把扩展固定到工具栏', '打开一篇你有权访问的公众号文章', '选择 Markdown', '单篇导出长期免费']) {
  if (!startPage.includes(requiredText)) errors.push(`首次使用页缺少关键步骤：${requiredText}`)
}

const supportPage = await readFile(join(siteDir, 'support', 'index.html'), 'utf8')
if (!supportPage.includes(wechatQrPath) || !supportPage.includes('加入微信交流群')) errors.push('支持页缺少本站微信交流群入口')
if (!supportPage.includes(wechatRemarks[2])) errors.push(`支持页缺少微信渠道备注：${wechatRemarks[2]}`)
if (!supportPage.includes('/purchase/')) errors.push('支持页缺少独立购买页入口')
if (supportPage.includes(purchaseUrl)) errors.push('支持页不得直接承接在线订单，购买意图应进入购买页')

const siteScript = await readFile(join(siteDir, 'site.js'), 'utf8')
for (const requiredValue of ['reader_panel', 'album_panel', 'library', 'generic_panel', 'welcome', 'manual_click', 'trial_used', 'source_surface', 'source_trigger']) {
  if (!siteScript.includes(requiredValue)) errors.push(`site.js 缺少购买来源白名单或统计字段：${requiredValue}`)
}
if (/\.get\(\s*['"]message['"]\s*\)/.test(siteScript)) errors.push('site.js 不得读取自由文本 message 参数')
if (!siteScript.includes('page_location: `${window.location.origin}${pagePath}`')) errors.push('site.js page_location 必须移除查询字符串')

const privacyPage = await readFile(join(siteDir, 'privacy', 'index.html'), 'utf8')
if (!privacyPage.includes('surface') || !privacyPage.includes('trigger') || !privacyPage.includes('不读取或发送自由文本')) {
  errors.push('隐私政策缺少购买来源白名单参数说明')
}
if (!privacyPage.includes('扩展会向运营者自建的 NAS Work 服务发送白名单事件')) {
  errors.push('隐私政策必须说明扩展匿名统计由自建服务接收')
}
if (/扩展[^。]{0,80}(?:直接发送|建立 HTTPS 请求)[^。]{0,40}Google/.test(privacyPage)) {
  errors.push('隐私政策不得宣称扩展直连 Google Analytics')
}
if (allText.includes('https://bzjkmn.cn/')) errors.push('产品站不得链接或热链个人博客 bzjkmn.cn')

for (const file of files.filter((item) => extname(item) === '.css')) {
  const relativePath = slash(relative(siteDir, file))
  const css = await readFile(file, 'utf8')
  if (/\b(?:Songti(?:\s+SC)?|STSong|SimSun)\b/i.test(css)) {
    errors.push(`${relativePath}: CSS 不得重新引入宋体展示字体`)
  }
  if (containsFixedGridBackground(css)) {
    errors.push(`${relativePath}: CSS 不得重新引入固定方格纸背景`)
  }
}

const release = JSON.parse(await readFile(join(siteDir, 'release.json'), 'utf8'))
for (const channel of ['current', 'previous']) {
  const item = release[channel]
  if (!item || !/^\d+\.\d+\.\d+$/.test(item.version)) {
    errors.push(`release.json: ${channel} 版本格式不正确`)
    continue
  }
  const expectedFile = `/downloads/wechat-to-markdown-${item.version}.zip`
  if (item.file !== expectedFile) errors.push(`release.json: ${channel} 文件名应为 ${expectedFile}`)
  const archivePath = join(siteDir, item.file.replace(/^\//, ''))
  try {
    const archive = await readFile(archivePath)
    if (archive.byteLength !== item.bytes) errors.push(`release.json: ${channel} 文件大小与实际 ZIP 不一致`)
    const digest = createHash('sha256').update(archive).digest('hex')
    if (digest !== item.sha256) errors.push(`release.json: ${channel} SHA-256 与实际 ZIP 不一致`)
  } catch {
    errors.push(`release.json: 缺少 ${expectedFile}`)
  }
}
if (release.current.file !== offlineDownloadPath) errors.push('站点离线下载地址未使用 release.json 当前版本')
const releasePages = [
  ['download/index.html', await readFile(join(siteDir, 'download', 'index.html'), 'utf8')],
  ['offline-install/index.html', await readFile(join(siteDir, 'offline-install', 'index.html'), 'utf8')],
]
for (const [relativePath, html] of releasePages) {
  if (!html.includes(release.current.version)) errors.push(`${relativePath}: 未显示 release.json 当前版本`)
  if (!html.includes(release.current.file)) errors.push(`${relativePath}: 未使用 release.json 当前下载文件`)
  if (!html.includes(release.current.sha256)) errors.push(`${relativePath}: 未显示 release.json 当前 SHA-256`)
}
const downloadPage = releasePages[0][1]
if (!downloadPage.includes(`${release.current.bytes.toLocaleString('en-US')} bytes`)) {
  errors.push('download/index.html: 文件大小与 release.json 不一致')
}
if (!downloadPage.includes(`${Math.round(release.current.bytes / 1024)} KiB`)) {
  errors.push('download/index.html: KiB 大小与 release.json 不一致')
}

if (files.some((file) => slash(relative(siteDir, file)) === 'CNAME')) {
  errors.push('site/CNAME 是 GitHub Pages 专用配置，Cloudflare Pages 站点不得保留')
}
const robots = await readFile(join(siteDir, 'robots.txt'), 'utf8')
if (!robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`)) errors.push('robots.txt 缺少正式 sitemap 地址')

for (const file of files.filter((item) => ['.png', '.avif', '.webp', '.jpg', '.jpeg'].includes(extname(item)))) {
  const size = (await stat(file)).size
  if (size > 500_000) errors.push(`${slash(relative(siteDir, file))}: 图片超过 500 KB`)
}

const siteConfig = await readFile(join(siteDir, 'site-config.js'), 'utf8')
const measurementId = siteConfig.match(/ga4MeasurementId:\s*['"]([^'"]*)['"]/)?.[1] ?? ''
if (measurementId && !/^G-[A-Z0-9]+$/.test(measurementId)) errors.push('site-config.js: GA4 Measurement ID 格式不正确')

if (errors.length) {
  console.error(errors.map((error) => `✗ ${error}`).join('\n'))
  process.exit(1)
}

console.log(`✓ ${canonicalUrls.size} 个正式页面的 SEO 元数据与 sitemap 一致`)
console.log('✓ 内部链接、结构化数据、商店 ID、本站下载与双购买路径检查通过')
console.log('✓ 所有页面已加载统一设计系统，旧版品牌、字体、方格背景与排他激活文案检查通过')
console.log('✓ 当前与上一版 ZIP 的文件大小和 SHA-256 与 release.json 一致')
console.log(measurementId ? `✓ 网站 GA4 已配置并默认加载：${measurementId}` : '○ 网站 GA4 尚未填写 Measurement ID，默认加载逻辑不会发送数据')

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await walk(path))
    else result.push(path)
  }
  return result
}

function matchAll(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => stripTags(match[1]).trim())
}

function matchOne(text, pattern, label) {
  const values = matchAll(text, pattern)
  if (values.length > 1) errors.push(`${label} 必须且只能有一个`)
  return values[0] || ''
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
}

function internalTargets(html) {
  const values = [...html.matchAll(/(?:href|src)=["'](\/[^"']*)["']/g)].map((match) => match[1])
  return [...new Set(values.map((value) => value.split(/[?#]/)[0]).filter(Boolean))]
}

function validateBrandIdentity(html, relativePath) {
  const brand = brandMarkup(html)
  const productName = matchAll(brand, /<strong>([\s\S]*?)<\/strong>/gi)
  if (productName.length !== 1 || productName[0] !== 'WeChat to Markdown') {
    errors.push(`${relativePath}: 页眉主品牌必须为 WeChat to Markdown，不得用域名替代插件名`)
  }
  if (relativePath === 'index.html' && !brand.includes('wx2md.com')) {
    errors.push('index.html: 页眉缺少 wx2md.com 官方网站域名标识')
  }
}

function validateVisualSystem(html, relativePath) {
  const stylesheets = stylesheetHrefs(html)
  const pageStylesheet = relativePath === 'index.html' ? '/homepage.css' : '/styles.css'
  const wrongPageStylesheet = relativePath === 'index.html' ? '/styles.css' : '/homepage.css'
  const designSystemCount = stylesheets.filter((href) => href === '/design-system.css').length
  const pageStylesheetCount = stylesheets.filter((href) => href === pageStylesheet).length

  if (designSystemCount !== 1) {
    errors.push(`${relativePath}: 必须且只能加载一次 /design-system.css`)
  }
  if (pageStylesheetCount !== 1) {
    errors.push(`${relativePath}: 必须且只能加载一次 ${pageStylesheet}`)
  }
  if (stylesheets.includes(wrongPageStylesheet)) {
    errors.push(`${relativePath}: 不得加载 ${wrongPageStylesheet}`)
  }

  const designSystemIndex = stylesheets.indexOf('/design-system.css')
  const pageStylesheetIndex = stylesheets.indexOf(pageStylesheet)
  if (designSystemIndex >= 0 && pageStylesheetIndex >= 0 && designSystemIndex > pageStylesheetIndex) {
    errors.push(`${relativePath}: /design-system.css 必须先于 ${pageStylesheet} 加载`)
  }
}

function validateLegacyBrandSubtitle(html, relativePath) {
  const brand = brandMarkup(html)
  if (stripTags(brand).includes('网页归档助手')) {
    errors.push(`${relativePath}: 页头品牌不得继续使用旧副标题“网页归档助手”`)
  }
}

function validateActivationCopy(html, relativePath) {
  const visibleText = stripTags(html)
  for (const pattern of legacyActivationCopy) {
    if (pattern.test(visibleText)) {
      errors.push(`${relativePath}: 激活说明仍包含只能前往本地文章库的旧文案`)
      return
    }
  }
}

function stylesheetHrefs(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => (attributeValue(tag, 'rel') || '').toLowerCase().split(/\s+/).includes('stylesheet'))
    .map((tag) => attributeValue(tag, 'href'))
    .filter(Boolean)
}

function attributeValue(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] || ''
}

function brandMarkup(html) {
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const classes = attributeValue(match[1], 'class').split(/\s+/)
    if (classes.includes('brand')) return match[2]
  }
  return ''
}

function containsFixedGridBackground(css) {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = match[2]
    const gradientCount = declarations.match(/linear-gradient\s*\(/gi)?.length || 0
    const hasPixelGridSize = /background-size\s*:\s*\d+(?:\.\d+)?px\s+\d+(?:\.\d+)?px/i.test(declarations)
    if (/position\s*:\s*fixed/i.test(declarations) && gradientCount >= 2 && hasPixelGridSize) return true
  }
  return false
}

function validatePrimaryNavigation(html, relativePath) {
  const markup = html.match(/<nav\s+class=["'][^"']*\bsite-nav\b[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1]
  if (!markup) {
    errors.push(`${relativePath}: 缺少顶部主导航`)
    return
  }

  const links = [...markup.matchAll(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      label: stripTags(match[4]).trim(),
      href: match[2],
      current: /\baria-current=["'][^"']+["']/i.test(`${match[1]} ${match[3]}`),
    }))
  const actualNavigation = links.map(({ label, href }) => ({ label, href }))
  if (JSON.stringify(actualNavigation) !== JSON.stringify(expectedNavigation)) {
    errors.push(`${relativePath}: 顶部导航必须固定为“功能、价格、使用教程、支持、免费安装”及统一链接`)
  }

  const currentLabels = links.filter((link) => link.current).map((link) => link.label)
  const expectedCurrent = expectedCurrentNavigation.get(relativePath)
  if (expectedCurrent && (currentLabels.length !== 1 || currentLabels[0] !== expectedCurrent)) {
    errors.push(`${relativePath}: 顶部导航当前项应为“${expectedCurrent}”`)
  }
  if (!expectedCurrent && currentLabels.length > 0) {
    errors.push(`${relativePath}: 顶部导航不应标记不对应当前页面的选项`)
  }
}

async function targetExists(target) {
  const decoded = decodeURIComponent(target)
  const candidate = decoded.endsWith('/') ? `${decoded}index.html` : decoded
  const file = resolve(siteDir, `.${candidate}`)
  if (!file.startsWith(`${siteDir}${sep}`) && file !== siteDir) return false
  try {
    return (await stat(file)).isFile()
  } catch {
    return false
  }
}

function slash(value) {
  return value.split(sep).join('/')
}

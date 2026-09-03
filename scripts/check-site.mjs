import { readdir, readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

const siteDir = resolve('site')
const canonicalOrigin = 'https://wx2md.com'
const chromeStoreId = 'kbijkembfnijlgpkeofanhpoaefkddim'
const purchaseUrl = 'https://ai.bzjkmn.cn/cat/28'
const offlineDownloadPath = '/downloads/wechat-to-markdown-3.0.3.zip'
const wechatQrPath = '/assets/wechat.jpg'
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
for (const requiredText of [
  '单篇图片本地化',
  '试用 1 次',
  '最多导出 5 篇',
  '完整、增量、分卷、断点继续',
  '筛选、归档合集、批量导出',
  'Obsidian + 本机思源',
  '最多 2 台',
  '为什么不是订阅',
  '打开扩展的<strong>本地文章库</strong>',
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

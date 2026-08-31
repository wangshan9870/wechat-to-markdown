import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

const siteDir = resolve('site')
const canonicalOrigin = 'https://wx2md.com'
const chromeStoreId = 'kbijkembfnijlgpkeofanhpoaefkddim'
const purchaseUrl = 'https://ai.bzjkmn.cn/cat/28'
const expectedCanonicalPaths = new Map([
  ['index.html', '/'],
  ['wechat-to-markdown/index.html', '/wechat-to-markdown/'],
  ['wechat-collection/index.html', '/wechat-collection/'],
  ['wechat-to-obsidian/index.html', '/wechat-to-obsidian/'],
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
for (const forbidden of ['WTM_GA4_API_SECRET', '/mp/collect', 'api_secret=']) {
  if (allText.includes(forbidden)) errors.push(`站点文件包含禁止配置：${forbidden}`)
}
if (!allText.includes(chromeStoreId)) errors.push('站点缺少固定 Chrome Web Store 扩展 ID')
if (!allText.includes(purchaseUrl)) errors.push('站点缺少统一在线购买地址')

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
console.log('✓ 内部链接、结构化数据、商店 ID、购买地址与敏感配置检查通过')
console.log(measurementId ? `✓ 网站 GA4 已配置：${measurementId}` : '○ 网站 GA4 尚未填写 Measurement ID；同意组件已就绪但不会加载 Google Tag')

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

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const origin = 'https://wx2md.com'
const managed = /\n?<script type="application\/ld\+json" id="discovery-schema">[\s\S]*?<\/script>\n?/g
const schemaBlocks = html => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]))
const plain = text => text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim()
const xml = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Derive discovery files from published-page metadata, not a second route catalogue.
export async function syncDiscovery({ check = false, siteDir = resolve('site') } = {}) {
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    return (await Promise.all(entries.map(item => item.isDirectory() ? walk(join(dir, item.name)) : [join(dir, item.name)]))).flat()
  }
  const pages = []
  for (const file of (await walk(siteDir)).filter(file => file.endsWith('.html')).sort()) {
    const html = await readFile(file, 'utf8')
    if (/<meta\s+name="robots"[^>]*noindex/i.test(html)) continue
    const url = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
    if (!url?.startsWith(`${origin}/`)) throw new Error(`Missing official canonical: ${file}`)
    const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(([, lang, href]) => ({ lang, href }))
    pages.push({ file, html, url, alternates, lang: html.match(/<html lang="([^"]+)"/)[1], title: plain(html.match(/<title>([\s\S]*?)<\/title>/)[1]), description: plain(html.match(/<meta name="description" content="([^"]+)"/)[1]) })
  }
  pages.sort((a, b) => (a.lang === b.lang ? (a.url.length - b.url.length || a.url.localeCompare(b.url)) : a.lang === 'zh-CN' ? -1 : 1))
  const urls = new Set(pages.map(page => page.url))
  for (const page of pages) {
    if (page.alternates.length !== 3 || !['zh-CN', 'en', 'x-default'].every(lang => page.alternates.some(item => item.lang === lang))) throw new Error(`Incomplete language alternatives: ${page.url}`)
    for (const alternate of page.alternates) if (!urls.has(alternate.href)) throw new Error(`Unknown alternate: ${alternate.href}`)
  }
  const home = pages.find(page => page.url === `${origin}/`)
  const originalApp = schemaBlocks(home.html).find(item => item['@type'] === 'SoftwareApplication')
  if (!originalApp) throw new Error('Homepage SoftwareApplication is missing')
  // Prices remain on visible pricing pages; release ZIP facts remain in release.json.
  const { offers, downloadUrl, softwareVersion, ...app } = originalApp
  app['@id'] = `${origin}/#software`
  app.downloadUrl = `${origin}/download/`
  app.mainEntityOfPage = `${origin}/about/`
  app.author = { '@type': 'Person', '@id': `${origin}/about/#author`, name: '望山', url: `${origin}/about/` }
  const outputs = new Map()
  outputs.set(join(siteDir, 'product.jsonld'), JSON.stringify(app, null, 2) + '\n')
  outputs.set(join(siteDir, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + pages.map(page => `  <url>\n    <loc>${xml(page.url)}</loc>\n` + page.alternates.map(item => `    <xhtml:link rel="alternate" hreflang="${xml(item.lang)}" href="${xml(item.href)}"/>\n`).join('') + '  </url>\n').join('') + '</urlset>\n')
  for (const page of pages) {
    const base = page.html.replace(managed, '\n')
    const existing = schemaBlocks(base)
    const type = existing.find(item => ['FAQPage', 'AboutPage'].includes(item['@type']))?.['@type'] || 'WebPage'
    const graph = [{ '@type': type, '@id': `${page.url}#webpage`, url: page.url, name: page.title, description: page.description, inLanguage: page.lang, isPartOf: { '@id': `${origin}/#website` }, about: { '@id': `${origin}/#software` } }]
    if (page.url === `${origin}/` || page.url === `${origin}/en/`) {
      graph.push({ '@type': 'WebSite', '@id': `${origin}/#website`, url: `${origin}/`, name: 'WeChat to Markdown', inLanguage: ['zh-CN', 'en'], publisher: app.author })
      if (page.lang === 'en') graph.push({ ...app, description: page.description, downloadUrl: `${origin}/en/download/`, softwareHelp: `${origin}/en/support/` })
    }
    const block = '<script type="application/ld+json" id="discovery-schema">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c') + '</script>\n'
    outputs.set(page.file, base.replace('</head>', block + '</head>'))
  }
  const chinese = pages.filter(page => page.lang === 'zh-CN')
  const english = pages.filter(page => page.lang === 'en')
  const links = list => list.map(page => `- [${page.title}](${page.url}): ${page.description}`).join('\n')
  outputs.set(join(siteDir, 'llms.txt'), `# WeChat to Markdown\n\n> 望山开发的本地优先 Chrome 扩展，主要用于微信公众号阅读、保存与 Markdown 导出。官方网站：https://wx2md.com/。中文为默认语言，英文提供对应页面。\n\n文章正文在浏览器本地处理，不上传给运营者。授权验证、版本检查和可选产品统计有独立的数据边界，详见隐私政策。公开 Community 仓库提供单篇导出；商店完整版另含合集归档和付费功能。不绕过登录、付费墙或访问限制。\n\n价格、免费额度与活动截止时间以购买页及订单服务为准；当前 ZIP 版本与校验值以下载页和 release.json 为准。以下链接说明来自页面元数据，不独立维护价格与版本。\n\n## 中文页面\n\n${links(chinese)}\n\n## English pages\n\nLocal-first WeChat article archiving. Article bodies stay in the browser. The public Community repository and full store version have different feature scopes. See pricing and privacy pages for current terms.\n\n${links(english)}\n\n## Optional\n\n- [Product identity JSON-LD](${origin}/product.jsonld): Product name, maintainer and official links; not a pricing or release feed.\n- [Official ZIP release metadata](${origin}/release.json): Current and previous ZIP versions, sizes and SHA-256 digests.\n- [Sitemap](${origin}/sitemap.xml): Canonical pages and corresponding language versions.\n- [Community source](https://github.com/wangshan9870/wechat-to-markdown): Public single-article source code, not the complete store edition.\n`)
  const changed = []
  for (const [file, text] of outputs) {
    let current = ''
    try { current = await readFile(file, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (current === text) continue
    changed.push(relative(siteDir, file))
    if (!check) await writeFile(file, text)
  }
  if (check && changed.length) throw new Error(`Discovery metadata is stale; run npm run sync:discovery: ${changed.join(', ')}`)
  return { pages: pages.length, changed }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await syncDiscovery({ check: process.argv.includes('--check') })
  console.log(`Discovery: ${result.pages} pages; ${result.changed.length} changed files`)
}

import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { describe, it, expect } from 'vitest'

const site = new URL('../site/', import.meta.url)
const read = path => readFile(new URL(path, site), 'utf8')
const routes = ['', ...(await readdir(site, { withFileTypes: true }))
  .filter(item => item.isDirectory() && item.name !== 'en' && existsSync(new URL(`${item.name}/index.html`, site)))
  .map(item => `${item.name}/`)]

describe('paired static language pages', () => {
  it('keeps every content route available in both languages with reciprocal metadata and links', async () => {
    for (const route of routes) {
      for (const prefix of ['', 'en/']) {
        const page = await read(`${prefix}${route}index.html`)
        const alternate = prefix ? `/${route}` : `/en/${route}`
        expect(page).toContain(`<html lang="${prefix ? 'en' : 'zh-CN'}"`)
        expect(page).toContain(`rel="canonical" href="https://wx2md.com/${prefix}${route}"`)
        expect(page).toContain(`hreflang="zh-CN" href="https://wx2md.com/${route}"`)
        expect(page).toContain(`hreflang="en" href="https://wx2md.com/en/${route}"`)
        expect(page).toContain(`class="language-switch" href="${alternate}"`)
        if (prefix) {
          for (const match of page.matchAll(/<a\b([^>]+)>/g)) {
            if (match[1].includes('language-switch')) continue
            const href = match[1].match(/href="([^"]+)"/)?.[1]
            if (!href?.startsWith('/') || href.startsWith('/downloads/')) continue
            expect(href, `${route}: ${href}`).toMatch(/^\/en\//)
            const [path, hash] = href.split('#')
            if (hash) expect(await read(`${path.slice(1)}index.html`)).toContain(`id="${hash}"`)
          }
        }
      }
    }
  })
  it('keeps localized release details tied to the same published ZIP', async () => {
    const { current } = JSON.parse(await read('release.json'))
    for (const prefix of ['', 'en/']) {
      for (const route of ['download', 'offline-install']) {
        const page = await read(`${prefix}${route}/index.html`)
        expect(page).toContain(current.version)
        expect(page).toContain(current.sha256)
      }
      expect(await read(`${prefix}download/index.html`)).toContain(current.file)
    }
  })
})

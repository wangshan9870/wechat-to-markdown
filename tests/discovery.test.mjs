import { mkdtemp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { syncDiscovery } from '../scripts/sync-discovery.mjs'

async function copyHtml(source, target) {
  await mkdir(target, { recursive: true })
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isDirectory()) await copyHtml(join(source, entry.name), join(target, entry.name))
    else if (entry.name.endsWith('.html')) await writeFile(join(target, entry.name), await readFile(join(source, entry.name)))
  }
}

describe('discovery metadata', () => {
  it('is reproducible and rejects outdated generated metadata after page changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wx2md-discovery-'))
    try {
      await copyHtml('site', dir)
      await syncDiscovery({ siteDir: dir })
      expect((await syncDiscovery({ siteDir: dir, check: true })).changed).toEqual([])
      const file = join(dir, 'en/about/index.html')
      await writeFile(file, (await readFile(file, 'utf8')).replace('<title>About ', '<title>Updated overview of '))
      await expect(syncDiscovery({ siteDir: dir, check: true })).rejects.toThrow('stale')
      await syncDiscovery({ siteDir: dir })
      expect((await syncDiscovery({ siteDir: dir, check: true })).changed).toEqual([])
      const llms = await readFile(join(dir, 'llms.txt'), 'utf8')
      expect(llms).toContain('Updated overview of WeChat to Markdown')
      const product = JSON.parse(await readFile(join(dir, 'product.jsonld'), 'utf8'))
      expect(product['@id']).toBe('https://wx2md.com/#software')
      expect(product.offers).toBeUndefined()
      expect(product.softwareVersion).toBeUndefined()
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})

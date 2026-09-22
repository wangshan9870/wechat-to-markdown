#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const siteDir = join(projectRoot, 'site')
const canonicalOrigin = 'https://wx2md.com'
const endpoint = 'https://api.indexnow.org/indexnow'
const keyPattern = /^[a-f0-9]{32}$/

const dryRun = process.argv.includes('--dry-run')

const { key, keyFile } = await readIndexNowKey()
const sitemap = await readFile(join(siteDir, 'sitemap.xml'), 'utf8')
const urls = [...sitemap.matchAll(/<loc>(https:\/\/wx2md\.com\/[^<]*)<\/loc>/g)]
  .map((match) => match[1])
  .filter((url) => !/\.(avif|png|jpe?g|webp|gif|svg|txt|xml)$/i.test(url))

if (urls.length === 0) {
  console.error('✗ sitemap.xml 没有可提交的正式 URL')
  process.exit(1)
}

const payload = {
  host: 'wx2md.com',
  key,
  keyLocation: `${canonicalOrigin}/${keyFile}`,
  urlList: urls,
}

if (dryRun) {
  console.log(`○ IndexNow 预演：将提交 ${urls.length} 个 URL`)
  console.log(`  keyLocation: ${payload.keyLocation}`)
  for (const url of urls) console.log(`  - ${url}`)
  process.exit(0)
}

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
})

const body = await response.text()
if (response.ok) {
  console.log(`✓ IndexNow 已提交 ${urls.length} 个 URL（HTTP ${response.status}）`)
  if (body.trim()) console.log(body.trim())
  process.exit(0)
}

console.error(`✗ IndexNow 提交失败：HTTP ${response.status}`)
if (body.trim()) console.error(body.trim())
process.exit(1)

async function readIndexNowKey() {
  const files = (await readdir(siteDir)).filter((name) => extname(name) === '.txt' && keyPattern.test(name.slice(0, -4)))
  if (files.length !== 1) {
    throw new Error('site/ 必须恰好有一个 32 位十六进制 IndexNow 密钥文件，例如 site/<key>.txt')
  }

  const keyFile = files[0]
  const key = (await readFile(join(siteDir, keyFile), 'utf8')).trim()
  if (key !== keyFile.slice(0, -4)) {
    throw new Error(`${keyFile} 的内容必须与文件名（不含扩展名）一致`)
  }
  return { key, keyFile }
}

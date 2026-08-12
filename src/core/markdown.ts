import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import type { Article } from './types'

function yamlString(value: string): string {
  return JSON.stringify(value.replace(/\r?\n/g, ' '))
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export function articleToMarkdown(article: Article, savedAt = new Date()): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
  })
  turndown.use(gfm)
  turndown.addRule('wechatSection', {
    filter: 'section',
    replacement: (content) => `\n\n${content.trim()}\n\n`,
  })
  turndown.addRule('wechatImage', {
    filter: 'img',
    replacement: (_content, node) => {
      const image = node as HTMLImageElement
      const source = image.getAttribute('data-src') || image.getAttribute('src') || ''
      return source ? `![${image.alt || ''}](${source})` : ''
    },
  })

  const metadata = [
    '---',
    `title: ${yamlString(article.title)}`,
    `account: ${yamlString(article.accountName || '')}`,
    `author: ${yamlString(article.author || '')}`,
    `published_at: ${yamlString(article.publishTime || '')}`,
    `source: ${yamlString(article.sourceUrl)}`,
    'platform: "wechat"',
    `saved_at: ${yamlString(formatLocalDate(savedAt))}`,
    '---',
  ].join('\n')

  const body = turndown.turndown(article.html).trim()
  return `${metadata}\n\n# ${article.title}\n\n${body}\n`
}

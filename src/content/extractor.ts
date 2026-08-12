import type { Article } from '../core/types'
import { cleanArticleContent } from './cleaner'

function firstText(...selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.textContent?.trim()
    if (value) return value
  }
  return undefined
}

function metaContent(property: string): string | undefined {
  return document.querySelector<HTMLMetaElement>(`meta[property="${property}"], meta[name="${property}"]`)
    ?.content.trim() || undefined
}

export function isWechatArticlePage(): boolean {
  return location.hostname === 'mp.weixin.qq.com' && Boolean(document.querySelector('#js_content'))
}

export function extractWechatArticle(): Article {
  if (!isWechatArticlePage()) {
    throw new Error('当前页面不是可识别的微信公众号文章')
  }

  const content = document.querySelector<HTMLElement>('#js_content')
  if (!content) throw new Error('没有找到文章正文')

  const title = firstText('#activity-name', '.rich_media_title')
    || metaContent('og:title')
    || document.title.replace(/\s*[-_]\s*微信公众平台\s*$/, '').trim()
    || '未命名文章'
  const accountName = firstText('#js_name', '.rich_media_meta_nickname')
    || metaContent('og:article:author')
  const author = firstText('#js_author_name', '.rich_media_meta_text')
  const publishTime = firstText('#publish_time', '#js_publish_time', '.rich_media_meta_text')
  const cleaned = cleanArticleContent(content)

  return {
    title,
    author: author === publishTime ? undefined : author,
    accountName,
    publishTime,
    sourceUrl: location.href,
    html: cleaned.html,
    images: cleaned.images,
  }
}

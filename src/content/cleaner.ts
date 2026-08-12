import type { ArticleImage } from '../core/types'

const REMOVED_SELECTORS = [
  'script',
  'style',
  'iframe',
  'noscript',
  '.js_ad_link',
  '.weapp_display_element',
  '[data-type="ad"]',
]

export function cleanArticleContent(source: HTMLElement): {
  html: string
  images: ArticleImage[]
} {
  const clone = source.cloneNode(true) as HTMLElement
  clone.querySelectorAll(REMOVED_SELECTORS.join(',')).forEach((element) => element.remove())

  const images: ArticleImage[] = []
  clone.querySelectorAll('img').forEach((image) => {
    const src = image.getAttribute('data-src') || image.getAttribute('src')
    if (!src || src.startsWith('data:image/svg')) {
      image.remove()
      return
    }
    image.setAttribute('src', src)
    image.removeAttribute('srcset')
    image.removeAttribute('style')
    images.push({ src, alt: image.alt || undefined })
  })

  clone.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.removeAttribute('class')
    element.removeAttribute('style')
    element.removeAttribute('id')
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.startsWith('data-') && attribute.name !== 'data-src') {
        element.removeAttribute(attribute.name)
      }
    }
  })

  return { html: clone.innerHTML, images }
}

import { describe, expect, it } from 'vitest'
import { imageExtension, localImageName, replaceMarkdownImageSource } from '../src/core/images'

describe('image archive helpers', () => {
  it('prefers the response content type over the URL', () => {
    expect(imageExtension('image/webp; charset=binary', 'https://example.com/image.jpg')).toBe('webp')
  })

  it('falls back to a supported URL extension', () => {
    expect(imageExtension(null, 'https://example.com/path/photo.jpeg')).toBe('jpg')
    expect(imageExtension(null, 'https://example.com/get?wx_fmt=png')).toBe('jpg')
  })

  it('creates stable numbered paths', () => {
    expect(localImageName(0, 'png')).toBe('images/001.png')
    expect(localImageName(11, 'webp')).toBe('images/012.webp')
  })

  it('only rewrites matching Markdown image targets', () => {
    const remote = 'https://mmbiz.qpic.cn/a'
    const markdown = `![封面](${remote})\n\n[来源](https://example.com)`
    expect(replaceMarkdownImageSource(markdown, remote, 'images/001.jpg'))
      .toBe('![封面](./images/001.jpg)\n\n[来源](https://example.com)')
  })
})

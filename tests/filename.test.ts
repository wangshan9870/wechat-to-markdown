import { describe, expect, it } from 'vitest'
import { createMarkdownFilename } from '../src/core/filename'

describe('createMarkdownFilename', () => {
  it('removes cross-platform invalid characters', () => {
    expect(createMarkdownFilename('一篇 / 好文章: 入门?')).toBe('一篇 好文章 入门.md')
  })

  it('falls back for blank and reserved names', () => {
    expect(createMarkdownFilename('  ')).toBe('wechat-article.md')
    expect(createMarkdownFilename('CON')).toBe('wechat-article.md')
  })

  it('limits long names', () => {
    expect(createMarkdownFilename('a'.repeat(200))).toHaveLength(123)
  })
})

import { articleToMarkdown } from '../core/markdown'
import type { ExtensionRequest, ExtensionResponse } from '../core/types'
import { extractWechatArticle } from './extractor'

chrome.runtime.onMessage.addListener(
  (request: ExtensionRequest, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    try {
      const article = extractWechatArticle()
      sendResponse(request.type === 'EXTRACT_ARTICLE'
        ? { success: true, article, markdown: articleToMarkdown(article) }
        : { success: true, article })
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : '无法读取当前页面',
      })
    }
    return false
  },
)

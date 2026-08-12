import { articleToMarkdown } from '../core/markdown'
import type { ContentRequest, ContentResponse, ExportRequest, ExportResponse } from '../core/types'
import { extractWechatArticle, isWechatArticlePage } from './extractor'

chrome.runtime.onMessage.addListener(
  (request: ContentRequest, _sender, sendResponse: (response: ContentResponse) => void) => {
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

function exportSummary(response: ExportResponse, downloadImages: boolean): string {
  if (!response.success) return response.error
  if (!downloadImages) return 'Markdown 已保存'
  if (response.failedImages) {
    return `已保存 ${response.downloadedImages} 张，${response.failedImages} 张保留网络地址`
  }
  return `完整文章已保存 · ${response.downloadedImages} 张图片`
}

function mountQuickSave(): void {
  if (!isWechatArticlePage() || document.querySelector('#wechat-read-entry')) return

  const host = document.createElement('div')
  host.id = 'wechat-read-entry'
  const shadow = host.attachShadow({ mode: 'closed' })
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap { position: fixed; right: 22px; bottom: 28px; z-index: 2147483647; display: grid; justify-items: end; gap: 9px; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
      button { display: grid; width: 48px; height: 48px; place-items: center; border: 0; border-radius: 15px 5px 15px 5px; color: #fff; background: #087f4e; box-shadow: 0 9px 25px rgba(5, 67, 40, .27); font: 700 18px/1 STSong, SimSun, serif; cursor: pointer; transition: transform .16s ease, background .16s ease; }
      button:hover { transform: translateY(-2px); background: #066d43; }
      button:focus-visible { outline: 3px solid #a6dbc0; outline-offset: 3px; }
      button:disabled { cursor: wait; opacity: .7; transform: none; }
      .note { max-width: 250px; padding: 8px 11px; border: 1px solid #dbe5de; border-radius: 9px; color: #33443a; background: rgba(251, 253, 251, .96); box-shadow: 0 7px 20px rgba(27, 48, 35, .12); font-size: 12px; line-height: 1.45; opacity: 0; transform: translateY(4px); pointer-events: none; transition: opacity .16s ease, transform .16s ease; }
      .note.show { opacity: 1; transform: translateY(0); }
      @media (prefers-reduced-motion: reduce) { button, .note { transition: none; } }
    </style>
    <div class="wrap">
      <div class="note" role="status" aria-live="polite"></div>
      <button type="button" title="使用 WeChat Read 快速保存文章" aria-label="快速保存当前文章">存</button>
    </div>`

  const button = shadow.querySelector<HTMLButtonElement>('button')!
  const note = shadow.querySelector<HTMLElement>('.note')!
  let hideTimer: number | undefined
  const showNote = (message: string): void => {
    note.textContent = message
    note.classList.add('show')
    if (hideTimer) window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => note.classList.remove('show'), 5000)
  }

  button.addEventListener('click', async () => {
    button.disabled = true
    button.textContent = '…'
    try {
      const stored = await chrome.storage.local.get('downloadImages')
      const downloadImages = stored.downloadImages === true
      showNote(downloadImages ? '正在下载图片并打包…' : '正在生成 Markdown…')
      const article = extractWechatArticle()
      const request: ExportRequest = {
        type: 'EXPORT_ARTICLE', article, markdown: articleToMarkdown(article), downloadImages,
      }
      const response = await chrome.runtime.sendMessage(request) as ExportResponse
      showNote(exportSummary(response, downloadImages))
    } catch (error) {
      showNote(error instanceof Error ? error.message : '保存失败，请稍后重试')
    } finally {
      button.disabled = false
      button.textContent = '存'
    }
  })

  document.documentElement.append(host)
}

mountQuickSave()

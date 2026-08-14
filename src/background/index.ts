import JSZip from 'jszip'
import { createArchiveFilename, createMarkdownFilename, createSafeBasename } from '../core/filename'
import { imageExtension, localImageName, replaceMarkdownImageSource } from '../core/images'
import type { ContentRequest, ExportRequest, ExportResponse, QuickSaveResponse } from '../core/types'

const DEFAULT_ACTION_TITLE = '保存微信文章'

async function showCommandError(tabId: number, message: string): Promise<void> {
  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#c62828' }),
    chrome.action.setBadgeText({ tabId, text: '!' }),
    chrome.action.setTitle({ tabId, title: `快捷保存失败：${message}` }),
  ])
  setTimeout(() => {
    void chrome.action.setBadgeText({ tabId, text: '' })
    void chrome.action.setTitle({ tabId, title: DEFAULT_ACTION_TITLE })
  }, 5000)
}

async function downloadDataUrl(url: string, filename: string): Promise<void> {
  await chrome.downloads.download({ url, filename, saveAs: true })
}

async function exportMarkdown(request: ExportRequest): Promise<ExportResponse> {
  const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(request.markdown)}`
  await downloadDataUrl(url, createMarkdownFilename(request.article.title))
  return { success: true, downloadedImages: 0, failedImages: 0 }
}

async function exportArchive(request: ExportRequest): Promise<ExportResponse> {
  const zip = new JSZip()
  let markdown = request.markdown
  let downloadedImages = 0
  let failedImages = 0
  const uniqueSources = [...new Set(request.article.images.map((image) => image.src))]

  for (const [index, source] of uniqueSources.entries()) {
    try {
      const response = await fetch(source, { credentials: 'omit', referrerPolicy: 'no-referrer' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const extension = imageExtension(response.headers.get('content-type'), source)
      const localName = localImageName(index, extension)
      zip.file(localName, await response.arrayBuffer())
      markdown = replaceMarkdownImageSource(markdown, source, localName)
      downloadedImages += 1
    } catch {
      failedImages += 1
    }
  }

  zip.file(`${createSafeBasename(request.article.title)}.md`, markdown)
  const archive = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' })
  await downloadDataUrl(`data:application/zip;base64,${archive}`, createArchiveFilename(request.article.title))
  return { success: true, downloadedImages, failedImages }
}

chrome.runtime.onMessage.addListener(
  (request: ExportRequest, _sender, sendResponse: (response: ExportResponse) => void) => {
    if (request.type !== 'EXPORT_ARTICLE') return false

    const operation = request.downloadImages ? exportArchive(request) : exportMarkdown(request)
    void operation
      .then(sendResponse)
      .catch((error) => sendResponse({
        success: false,
        error: error instanceof Error ? error.message : '文章导出失败',
      }))
    return true
  },
)

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'quick-save') return
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    try {
      const request: ContentRequest = { type: 'QUICK_SAVE' }
      const response = await chrome.tabs.sendMessage(tab.id, request) as QuickSaveResponse
      if (!response.success) await showCommandError(tab.id, response.error)
    } catch {
      await showCommandError(tab.id, '请打开微信公众号文章，或刷新页面后再试')
    }
  })()
})

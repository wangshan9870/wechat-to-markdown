import JSZip from 'jszip'
import { createArchiveFilename, createMarkdownFilename, createSafeBasename } from '../core/filename'
import { imageExtension, localImageName, replaceMarkdownImageSource } from '../core/images'
import type { ExportRequest, ExportResponse } from '../core/types'

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

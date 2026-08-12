import '../popup/style.css'
import type { Article, ContentRequest, ContentResponse, ExportRequest, ExportResponse } from '../core/types'

const loading = document.querySelector<HTMLElement>('#loading')!
const ready = document.querySelector<HTMLElement>('#ready')!
const unsupported = document.querySelector<HTMLElement>('#unsupported')!
const title = document.querySelector<HTMLElement>('#title')!
const account = document.querySelector<HTMLElement>('#account')!
const saveButton = document.querySelector<HTMLButtonElement>('#save')!
const feedback = document.querySelector<HTMLElement>('#feedback')!
const errorMessage = document.querySelector<HTMLElement>('#error-message')!
const downloadImagesInput = document.querySelector<HTMLInputElement>('#download-images')!
const saveLabel = document.querySelector<HTMLElement>('#save-label')!

let activeTabId: number | undefined
let currentArticle: Article | undefined

function show(target: HTMLElement): void {
  for (const section of [loading, ready, unsupported]) section.classList.add('hidden')
  target.classList.remove('hidden')
}

async function sendToPage(request: ContentRequest): Promise<ContentResponse> {
  if (!activeTabId) return { success: false, error: '没有找到当前标签页' }
  try {
    return await chrome.tabs.sendMessage(activeTabId, request) as ContentResponse
  } catch {
    return { success: false, error: '请刷新文章页面后再试' }
  }
}

function updateSaveLabel(): void {
  saveLabel.textContent = downloadImagesInput.checked ? '保存完整文章' : '保存 Markdown'
}

function exportSummary(response: ExportResponse): string {
  if (!response.success) return response.error
  if (!downloadImagesInput.checked) return 'Markdown 已交给浏览器保存'
  if (response.failedImages) {
    return `已保存 ${response.downloadedImages} 张，${response.failedImages} 张保留网络地址`
  }
  return `完整文章已保存，共 ${response.downloadedImages} 张图片`
}

async function inspectPage(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  activeTabId = tab?.id
  const response = await sendToPage({ type: 'INSPECT_PAGE' })
  if (!response.success) {
    errorMessage.textContent = response.error
    show(unsupported)
    return
  }

  currentArticle = response.article
  title.textContent = response.article.title
  account.textContent = response.article.accountName || '公众号文章'
  show(ready)
}

saveButton.addEventListener('click', async () => {
  if (!currentArticle) return
  saveButton.disabled = true
  feedback.textContent = downloadImagesInput.checked ? '正在下载图片并打包…' : '正在生成 Markdown…'

  const response = await sendToPage({ type: 'EXTRACT_ARTICLE' })
  if (!response.success || !response.markdown) {
    feedback.textContent = response.success ? '生成失败，请刷新页面后再试' : response.error
    saveButton.disabled = false
    return
  }

  try {
    const request: ExportRequest = {
      type: 'EXPORT_ARTICLE',
      article: response.article,
      markdown: response.markdown,
      downloadImages: downloadImagesInput.checked,
    }
    const exportResponse = await chrome.runtime.sendMessage(request) as ExportResponse
    feedback.textContent = exportSummary(exportResponse)
    if (!exportResponse.success) saveButton.disabled = false
  } catch {
    feedback.textContent = '下载未完成，请检查浏览器下载权限'
    saveButton.disabled = false
  }
})

downloadImagesInput.addEventListener('change', () => {
  updateSaveLabel()
  void chrome.storage.local.set({ downloadImages: downloadImagesInput.checked })
})

void chrome.storage.local.get('downloadImages').then(({ downloadImages = false }) => {
  downloadImagesInput.checked = downloadImages === true
  updateSaveLabel()
})
void inspectPage()

import '../popup/style.css'
import { createMarkdownFilename } from '../core/filename'
import type { Article, ExtensionRequest, ExtensionResponse } from '../core/types'

const loading = document.querySelector<HTMLElement>('#loading')!
const ready = document.querySelector<HTMLElement>('#ready')!
const unsupported = document.querySelector<HTMLElement>('#unsupported')!
const title = document.querySelector<HTMLElement>('#title')!
const account = document.querySelector<HTMLElement>('#account')!
const saveButton = document.querySelector<HTMLButtonElement>('#save')!
const feedback = document.querySelector<HTMLElement>('#feedback')!
const errorMessage = document.querySelector<HTMLElement>('#error-message')!

let activeTabId: number | undefined
let currentArticle: Article | undefined

function show(target: HTMLElement): void {
  for (const section of [loading, ready, unsupported]) section.classList.add('hidden')
  target.classList.remove('hidden')
}

async function sendToPage(request: ExtensionRequest): Promise<ExtensionResponse> {
  if (!activeTabId) return { success: false, error: '没有找到当前标签页' }
  try {
    return await chrome.tabs.sendMessage(activeTabId, request) as ExtensionResponse
  } catch {
    return { success: false, error: '请刷新文章页面后再试' }
  }
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
  feedback.textContent = '正在生成 Markdown…'

  const response = await sendToPage({ type: 'EXTRACT_ARTICLE' })
  if (!response.success || !response.markdown) {
    feedback.textContent = response.success ? '生成失败，请刷新页面后再试' : response.error
    saveButton.disabled = false
    return
  }

  const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(response.markdown)}`
  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename: createMarkdownFilename(response.article.title),
      saveAs: true,
    })
    feedback.textContent = '已交给浏览器保存'
  } catch {
    feedback.textContent = '下载未完成，请检查浏览器下载权限'
    saveButton.disabled = false
  }
})

void inspectPage()

export interface ArticleImage {
  src: string
  alt?: string
}

export interface Article {
  title: string
  author?: string
  accountName?: string
  publishTime?: string
  sourceUrl: string
  html: string
  images: ArticleImage[]
}

export type ContentRequest =
  | { type: 'INSPECT_PAGE' }
  | { type: 'EXTRACT_ARTICLE' }

export type ContentResponse =
  | { success: true; article: Article; markdown?: string }
  | { success: false; error: string }

export interface ExportRequest {
  type: 'EXPORT_ARTICLE'
  article: Article
  markdown: string
  downloadImages: boolean
}

export type ExportResponse =
  | { success: true; downloadedImages: number; failedImages: number }
  | { success: false; error: string }

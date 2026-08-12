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

export type ExtensionRequest =
  | { type: 'INSPECT_PAGE' }
  | { type: 'EXTRACT_ARTICLE' }

export type ExtensionResponse =
  | { success: true; article: Article; markdown?: string }
  | { success: false; error: string }

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

export function imageExtension(contentType: string | null, sourceUrl: string): string {
  const normalizedType = contentType?.split(';')[0]?.trim().toLowerCase()
  if (normalizedType && CONTENT_TYPE_EXTENSIONS[normalizedType]) {
    return CONTENT_TYPE_EXTENSIONS[normalizedType]
  }

  try {
    const extension = new URL(sourceUrl).pathname.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase()
    if (extension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(extension)) {
      return extension === 'jpeg' ? 'jpg' : extension
    }
  } catch {
    // Invalid URLs are rejected by fetch later; use a broadly supported fallback here.
  }
  return 'jpg'
}

export function localImageName(index: number, extension: string): string {
  return `images/${String(index + 1).padStart(3, '0')}.${extension}`
}

export function replaceMarkdownImageSource(
  markdown: string,
  remoteSource: string,
  localSource: string,
): string {
  return markdown.split(`](${remoteSource})`).join(`](./${localSource})`)
}

const INVALID_FILENAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]/g
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export function createMarkdownFilename(title: string): string {
  const normalized = title
    .normalize('NFKC')
    .replace(INVALID_FILENAME_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120)

  const safeTitle = normalized && !RESERVED_WINDOWS_NAMES.test(normalized)
    ? normalized
    : 'wechat-article'

  return `${safeTitle}.md`
}

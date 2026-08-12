import type { ManifestV3Export } from '@crxjs/vite-plugin'

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: '微信文章存档',
  description: '把微信公众号文章保存为干净的 Markdown 文件。',
  version: '0.1.0',
  permissions: ['activeTab', 'downloads'],
  host_permissions: ['https://mp.weixin.qq.com/*'],
  action: {
    default_title: '保存微信文章',
    default_popup: 'src/popup/index.html',
  },
  content_scripts: [
    {
      matches: ['https://mp.weixin.qq.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
}

export default manifest

import type { ManifestV3Export } from '@crxjs/vite-plugin'

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'WeChat to Markdown',
  description: '把微信公众号文章和图片保存为本地 Markdown 归档。',
  version: '0.3.0',
  permissions: ['activeTab', 'downloads', 'storage'],
  host_permissions: ['https://mp.weixin.qq.com/*', 'https://mmbiz.qpic.cn/*'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_title: '保存微信文章',
    default_popup: 'src/popup/index.html',
  },
  commands: {
    'quick-save': {
      suggested_key: { default: 'Alt+Shift+W' },
      description: '快速保存当前微信文章',
    },
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

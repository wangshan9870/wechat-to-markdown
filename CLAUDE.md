# WeChat to Markdown 项目规范

## 产品目标

把微信公众号文章可靠地保存为带 YAML Front Matter 的 Markdown 文件，并允许用户选择将图片一并本地归档。项目仅做本地浏览器扩展，不引入账号、后端或数据库。

## 技术约定

- Chrome Extension Manifest V3
- TypeScript + Vite，Popup 使用原生 DOM API
- 页面采集、领域模型、Markdown 转换、下载职责分离
- 所有站点采集器输出统一的 `Article` 类型
- Content Script 负责读取、清洗页面和注入隔离的快捷入口
- Background 负责跨域获取图片、ZIP 打包和下载
- Chrome `commands` 快捷键由 Background 路由到当前标签页，并复用 Content Script 的保存流程
- Popup 负责设置归档偏好、触发操作和展示反馈
- “下载图片”默认关闭，用户偏好通过 `chrome.storage.local` 保存
- 图片归档失败不得静默丢图：保留网络地址并向用户报告失败数量
- 页面按钮与快捷键必须使用同一保存函数，并阻止并发重复导出
- 新增依赖前先确认原生浏览器 API 无法合理完成需求

## 目录约定

- `src/content/`：页面识别、微信公众号 DOM 提取与清洗
- `src/background/`：图片下载、ZIP 归档与浏览器下载
- `src/core/`：领域类型、Markdown 转换、文件名与 Front Matter
- `src/popup/`：用户界面和消息编排
- `public/`：Manifest 与静态资源
- `site/`：`wx2md.com` 的公开首页、搜索落地页、支持页和隐私政策站点；保持纯静态 HTML/CSS/JS，不引入框架或构建服务
- `site/assets/`：官网专用图标、截图与社交分享图；优先使用 WebP/AVIF，并控制首屏总资源体积
- `scripts/check-site.mjs`：官网链接、元数据、canonical、sitemap、结构化数据和敏感配置检查
- `.github/workflows/`：公开站点与扩展的持续集成检查；正式官网由 Cloudflare Pages 从 `main` 分支自动构建和部署
- `tests/`：与源码结构对应的单元测试
- `dist/`：构建产物，不提交 Git

## 质量门槛

- 修改后运行 `npm test` 和 `npm run build`
- UI 必须有加载、成功、不支持和失败状态
- 页面快捷入口必须使用 Shadow DOM 隔离，且支持键盘焦点
- 文件名必须兼容 Windows/macOS
- 不记录或上传文章内容
- 公开站点必须提供可直接访问的 `/`、`/support/` 和 `/privacy/`，隐私说明必须覆盖扩展实际权限和可选授权流程
- 官网唯一正式 Origin 为 `https://wx2md.com`；所有正式页面使用自引用 canonical，sitemap 只列正式可索引页面
- Cloudflare Pages 是官网唯一托管入口，项目名为 `wx2md`，构建命令为 `node scripts/check-site.mjs`，输出目录为 `site/`
- `www.wx2md.com` 必须永久重定向到 `https://wx2md.com`，不得与主域同时提供可索引的重复页面
- 官网主定位固定为“微信公众号阅读、保存与 Markdown 导出工具”；普通网页支持只能作为次级能力，不得改写为全网万能工具
- 首页主转化固定为 Chrome Web Store 免费安装，¥29 永久版作为次级转化；购买入口统一指向 `https://ai.bzjkmn.cn/cat/28`
- 每个搜索落地页只承接一个明确意图，必须提供独立步骤、示例、限制和内部链接，不得批量生成只替换关键词的薄页面
- 每个可索引页面必须包含唯一 title、description、H1、canonical 和 Open Graph；结构化数据只能描述页面真实可见内容
- 官网统计只能在用户明确同意后加载；只允许白名单事件和粗粒度页面参数，不发送查询串、表单内容或其他个人信息
- 网站只允许公开的 GA4 Measurement ID，不得包含 Measurement Protocol API Secret、授权 Token、邮箱或卡密
- 新增或修改官网页面后必须运行 `node scripts/check-site.mjs`，并在 375、768、1440 像素宽度检查布局与键盘可访问性
- 提交前检查 `git status`，只提交当前任务文件

## Git 约定

- Commit message 使用简洁英文，描述变更意图
- 不自动 push
- 不提交 `node_modules/`、`dist/`、日志或编辑器配置

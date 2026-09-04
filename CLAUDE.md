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
- `site/downloads/`：官网直接分发的当前与上一版正式 ZIP；版本、大小和 SHA-256 以 `site/release.json` 为单一来源，发布前必须对实际文件重新计算校验
- `site/start/`：安装后的首次使用路径；`site/download/`：安装渠道选择与正式版本信息；`site/offline-install/`：离线安装和手动更新步骤；`site/purchase/`：权益、价格、在线购买与微信购买选择；`site/support/`：排障、反馈与交流群
- `scripts/check-site.mjs`：官网链接、元数据、canonical、sitemap、结构化数据和敏感配置检查
- `.github/workflows/`：公开站点与扩展的持续集成检查；正式官网默认由 Cloudflare Pages 从 `main` 分支自动构建和部署
- `scripts/deploy-site.mjs`：官网手动发布入口；允许从任意干净的 Git 分支部署当前 commit，通过全部检查后将 `site/` 显式发布到 Cloudflare Pages 的 `main` 生产分支
- `tests/`：与源码结构对应的单元测试
- `docs/pricing/`：定价活动的规则、上线检查点与截止日操作手册；先写清权益边界和系统事实来源，再修改公开页面
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
- 需要绕过 Git 自动部署、从本机直接更新官网时，统一运行 `npm run deploy:site`；首次使用按 README 运行固定版本的 Wrangler 登录命令，不得把 Cloudflare Token 写入仓库
- 手动部署遇到 Wrangler 可识别的瞬时网络错误、HTTP 429 或 5xx 时，只重试 Cloudflare 上传步骤，总尝试次数最多 3 次；不得重复前置测试和构建，权限或配置错误必须立即停止
- `www.wx2md.com` 必须永久重定向到 `https://wx2md.com`，不得与主域同时提供可索引的重复页面
- 官网主定位固定为“微信公众号阅读、保存与 Markdown 导出工具”；普通网页支持只能作为次级能力，不得改写为全网万能工具
- 首页主转化固定为免费安装，截止 2026 年 10 月 1 日 23:59（北京时间）的 ¥29 早鸟永久价作为次级转化；截止前支付成功的用户永久保留权益。普通页面的安装入口统一进入 `/download/`，购买入口统一进入 `/purchase/`，只有这两个选择页可以继续连接 Chrome Web Store、本站 ZIP 或 `https://wangshanai.website/item/50`
- 所有正式页面的顶部导航固定为“功能、价格、使用教程、支持、免费安装”，顺序、名称和链接目标不得随页面改变；当前页面只通过 `aria-current` 表示位置，不得把全局导航替换成页面内操作
- 产品流量、安装说明、离线包和二维码资源必须由 `wx2md.com` 自己承接，不得链接或热链个人博客 `bzjkmn.cn`；订单系统 `wangshanai.website`、授权服务 `work.bzjkmn.cn` 等必要产品服务不属于博客依赖
- 官网承接全部产品内容页；扩展不得继续维护首次使用、帮助、反馈/交流群、隐私、权益或购买说明的内部副本。扩展只保留文章库、目录选择、卡密激活等必须依赖扩展权限或本地数据的功能界面
- 所有安装入口先进入 `/download/` 让用户选择商店版或离线版；所有购买入口先进入 `/purchase/` 让用户选择在线自动发卡或微信人工开通，不得把其中一种路径藏掉
- `/purchase/` 是价格与权益的唯一事实来源；卡密只在扩展文章库的激活弹层输入，官网不得采集卡密，也不得宣称能直接激活扩展
- 官网只展示固定截止时间，不使用客户端倒计时或浏览器时间决定是否可购买；是否售卖和发放何种权益由订单系统与 NAS Work 卡池共同控制
- 每个搜索落地页只承接一个明确意图，必须提供独立步骤、示例、限制和内部链接，不得批量生成只替换关键词的薄页面
- 每个可索引页面必须包含唯一 title、description、H1、canonical 和 Open Graph；结构化数据只能描述页面真实可见内容
- 官网在页面加载时直接初始化 GA4；只允许白名单事件和粗粒度页面参数，不发送查询串、表单内容、文章数据或其他个人信息，也不展示统计同意弹窗
- 扩展匿名统计只发送到运营者自建 NAS Work 服务；官网隐私政策不得宣称扩展直连 GA4，Measurement Protocol API Secret 只能由可信服务端持有
- 网站只允许公开的 GA4 Measurement ID，不得包含 Measurement Protocol API Secret、授权 Token、邮箱或卡密
- 新增或修改官网页面后必须运行 `node scripts/check-site.mjs`，并在 375、768、1440 像素宽度检查布局与键盘可访问性
- 提交前检查 `git status`，只提交当前任务文件

## Git 约定

- Commit message 使用简洁英文，描述变更意图
- 不自动 push
- 不提交 `node_modules/`、`dist/`、日志或编辑器配置

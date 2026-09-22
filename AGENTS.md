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
- `site/`：`wx2md.com` 的公开首页、搜索落地页、支持页和隐私政策站点；保持纯静态 HTML/CSS/JS，不引入框架或构建服务；所有页面先加载 `design-system.css` 共享品牌变量、页头、按钮和页脚，首页使用 `homepage.css`，其他页面使用 `styles.css` 承载各自布局
- `site/en/`：全站英文版本，与中文页面一一对应；导航顺序一致，标签为 Features、Pricing、Guide、Support、Install free，目标保持在 `/en/` 下。两种语言共享静态资源与购买逻辑，每页提供对应页语言切换、自引用 canonical 与双向 hreflang。新增页面、权益或政策调整必须同步中英文内容；外部平台语言及微信联系备注不强行翻译。英文购买页与中文购买页同样禁止第三方统计；主动同意后可发送第一方粗粒度页面/来源统计，不传订单凭据，语言切换仅保留验证后的订单 fragment，不传播查询参数。
- `site/faq/`：完整常见问题与对应 FAQPage 数据；答案必须与可见正文一致，价格与权益链接到购买页。
- `site/_headers`：部署层脚本 CSP，仅允许本站脚本与同意后加载的 GA；中英文购买路径仅允许本站脚本，防止托管平台注入第三方统计绕过同意流程。
- `site/assets/`：官网专用图标、截图与社交分享图；优先使用 WebP/AVIF，并控制首屏总资源体积
- `site/downloads/`：官网直接分发的当前与上一版正式 ZIP；版本、大小和 SHA-256 以 `site/release.json` 为单一来源，发布前必须对实际文件重新计算校验
- `site/start/`：安装后的首次使用路径；`site/download/`：安装渠道选择与正式版本信息；`site/offline-install/`：离线安装和手动更新步骤；`site/purchase/`：权益、价格、在线购买与微信购买选择；`site/support/`：排障、反馈与交流群
- `scripts/sync-discovery.mjs`：从页面 canonical、hreflang、标题与简介生成 sitemap、页面 discovery JSON-LD、`site/product.jsonld` 和 `site/llms.txt`；修改页面元数据后运行 `npm run sync:discovery`。不编造 lastmod、评分或推荐背书；价格留在可见购买页，ZIP 数据沿用 release.json。站点检查必须校验产物没有过期。
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
- `WeChat to Markdown` 是插件与产品的正式名称，`wx2md.com` 只表示官网域名；页眉、页脚、安装入口和产品正文不得用 `wx2md` 替代插件名，展示二者关系时统一使用“`WeChat to Markdown` / `wx2md.com · 官方网站`”层级
- Cloudflare Pages 是官网唯一托管入口，项目名为 `wx2md`，构建命令为 `node scripts/check-site.mjs`，输出目录为 `site/`
- 需要绕过 Git 自动部署、从本机直接更新官网时，统一运行 `npm run deploy:site`；首次使用按 README 运行固定版本的 Wrangler 登录命令，不得把 Cloudflare Token 写入仓库
- 手动部署遇到 Wrangler 可识别的瞬时网络错误、HTTP 429 或 5xx 时，只重试 Cloudflare 上传步骤，总尝试次数最多 3 次；不得重复前置测试和构建，权限或配置错误必须立即停止
- `www.wx2md.com` 必须永久重定向到 `https://wx2md.com`，不得与主域同时提供可索引的重复页面
- 官网突出“公众号与普通文章型网页的本地保存与 Markdown 导出”：保留公众号深度适配，同时在首页首屏与核心功能展示博客、新闻、教程等网页能力。不得宣称支持所有网站或绕过访问控制；必须说明普通网页的主动操作入口、识别限制及共享免费额度
- 首页主转化固定为免费安装，套餐购买作为次级转化；已购早鸟永久权益保留。早鸟后常规方案为 ¥38/年、¥88 永久买断，当前可售价格以公开报价接口为准。普通页面的安装入口统一进入 `/download/`，购买入口统一进入 `/purchase/`，只有这两个选择页可以继续连接 Chrome Web Store、本站 ZIP 或 `https://wangshanai.website/item/50`
- 所有正式页面的顶部导航固定为“功能、价格、使用教程、支持、免费安装”，顺序、名称和链接目标不得随页面改变；当前页面只通过 `aria-current` 表示位置，不得把全局导航替换成页面内操作
- 产品流量、安装说明、离线包和二维码资源必须由 `wx2md.com` 自己承接，不得链接或热链个人博客 `bzjkmn.cn`；订单系统 `wangshanai.website`、授权服务 `work.bzjkmn.cn` 等必要产品服务不属于博客依赖
- 每个微信二维码旁必须紧邻显示“扫码后请备注”和一个可直接照抄的 `wx2md + 来意` 固定备注词；购买、产品支持与定价反馈使用不同备注词，并说明通过好友后的下一步，不得只写“备注来意”或依赖用户自行组织文案
- 官网承接全部产品内容页；扩展不得继续维护首次使用、帮助、反馈/交流群、隐私、权益或购买说明的内部副本。扩展只保留文章库、目录选择、卡密激活等必须依赖扩展权限或本地数据的功能界面
- 所有安装入口先进入 `/download/` 让用户选择商店版或离线版；所有购买入口先进入 `/purchase/` 让用户选择在线自动发卡或微信人工开通，不得把其中一种路径藏掉
- 公开 `/api/v1/pricing/plans/list` 是当前价格与套餐权益的唯一事实来源，首页和 `/purchase/` 共享 `pricing.js`，仅提交配置的 productCode，禁用缓存及凭据，按明确套餐 ID 下单；订单展示沿用订单快照，不被新报价覆盖。卡密只在已安装扩展的激活弹层输入，可从工具栏弹窗、文章页、合集页或本地文章库打开，官网不得采集卡密，也不得宣称能直接激活扩展
- 所有正式页面必须使用同一套视觉系统：统一品牌字体、颜色、页头、按钮、卡片、圆角和页脚；不得重新引入宋体展示标题、方格纸背景、黄色主操作按钮或不对称卡片圆角等旧版视觉元素
- 官网按报价 serverTime 与活动/停售边界使缓存失效并重新查询，不以客户端时间推算新价格；是否售卖和发放何种权益由订单系统与 NAS Work 共同控制
- 每个搜索落地页只承接一个明确意图，必须提供独立步骤、示例、限制和内部链接，不得批量生成只替换关键词的薄页面
- 每个可索引页面必须包含唯一 title、description、H1、canonical 和 Open Graph；结构化数据只能描述页面真实可见内容
- 官网默认不加载 GA4，用户主动同意后才加载；提供拒绝与随时撤回入口。只允许白名单事件和粗粒度页面参数，不发送查询串、fragment、referrer、表单内容或文章数据；购买页永不加载 GA4
- 扩展产品使用统计只发送到运营者自建 NAS Work 服务；官网隐私政策不得宣称扩展直连 GA4，Measurement Protocol API Secret 只能由可信服务端持有
- 网站只允许公开的 GA4 Measurement ID，不得包含 Measurement Protocol API Secret、授权 Token、邮箱或卡密
- 新增或修改官网页面后必须运行 `node scripts/check-site.mjs`，并在 375、768、1440 像素宽度检查布局与键盘可访问性
- 提交前检查 `git status`，只提交当前任务文件

## 官网购买与交付

- `/purchase/` 使用静态 JavaScript 调用 NAS Work `/api/v1/store/` 接口；后端统一定价、核验微信支付、生成卡密，扩展无需新增账号。
- 购买页只展示已交付卡密，不采集卡密输入。微信支付二维码不适用人工联系二维码的备注规则。
- 订单访问凭证在首次下单前生成并保留于 URL fragment；不写入查询串、日志、统计或第三方服务。购买页不加载 GA4，其他页面按用户选择启用统计。
- 本地 `checkout.js` 管理订单交互，二维码使用可信后端返回的 PNG data URL；购买关闭或配置不完整时禁用在线下单并保留人工购买入口。
- 订单价格和可售状态以 NAS Work 返回为准；页面时间不决定交易状态。

## 版本说明

- Community v0.3.0 仅开源公众号单篇导出、图片本地化和快捷保存的核心 MVP，不等于商店免费版。商店产品独立迭代，在同一安装包内提供免费与会员权益；官网离线 ZIP 是另一安装渠道，不能标为开源 MVP。
- 官网中英文首页、下载页、FAQ 与关于页必须明确该边界；不在介绍文案中硬编码商店最新版本或更新时间，以实际商店页面及 release.json 为准。

## Git 约定

- Commit message 使用简洁英文，描述变更意图
- 不自动 push
- 不提交 `node_modules/`、`dist/`、日志或编辑器配置

## 网站来源统计

- NAS Work 网站统计仅在同意后启用，产品编码/API地址配置化。网站随机标识与扩展、订单凭据分离；同标签页在无新来源参数时保留归因，新的有效显式来源参数更新归因，撤回清理标识与来源。
- 仅上报白名单页面分类、来源渠道code、浏览器及设备类别；原始URL、referrer、UA、订单号、卡密和访问凭据不得进入统计。未知直接访问标为direct_unknown，未知外站为referral。
- 购买页可发送同意后的第一方页面/购买入口统计及下单来源快照，永不加载GA或第三方脚本；客户端不发送支付成功事件。

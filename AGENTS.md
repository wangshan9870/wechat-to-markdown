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
- `site/`：只保留说明。正式官网是 https://wx2md.com ，由独立站点仓库发布。本仓库不得恢复可部署页面、sitemap、结构化数据，也不得把 `site/` 上传到 Cloudflare Pages
- `tests/`：与源码结构对应的单元测试
- `docs/pricing/`：定价活动的历史规则。公开页面与报价实现不在本仓库，改官网前先到站点仓库
- `dist/`：构建产物，不提交 Git

## 质量门槛

- 修改后运行 `npm test` 和 `npm run build`
- UI 必须有加载、成功、不支持和失败状态
- 页面快捷入口必须使用 Shadow DOM 隔离，且支持键盘焦点
- 文件名必须兼容 Windows/macOS
- 不记录或上传文章内容
- 正式官网只有 https://wx2md.com ，不在本仓库。介绍文案指向该域名；不得把本仓库的 `site/` 写成可发布站点，也不得恢复部署脚本
- `WeChat to Markdown` 是插件与产品的正式名称，`wx2md.com` 只表示官网域名。展示二者关系时使用“`WeChat to Markdown` / `wx2md.com · 官方网站`”
- 不得宣称支持所有网站或绕过访问控制。本仓库源码只处理用户主动打开的微信公众号文章页
- 扩展不得维护首次使用、帮助、反馈、隐私、权益或购买说明的内部副本。这些页面在官网上
- 提交前检查 `git status`，只提交当前任务文件

## 官网

购买、价格、安装渠道和隐私说明以 https://wx2md.com 为准。本仓库不实现下单、报价或站点统计，也不采集卡密。

## 版本说明

- Community v0.3.0 仅开源公众号单篇导出、图片本地化和快捷保存的核心 MVP，不等于商店免费版。商店产品独立迭代，在同一安装包内提供免费与会员权益；官网离线 ZIP 是另一安装渠道，不能标为开源 MVP。
- 介绍文案必须明确该边界；不在本仓库硬编码商店最新版本或更新时间，以 Chrome 商店页面和 https://wx2md.com 为准。

## Git 约定

- Commit message 使用简洁英文，描述变更意图
- 不自动 push
- 不提交 `node_modules/`、`dist/`、日志或编辑器配置

## 网站来源统计

官网统计不在本仓库实现。扩展不得上传文章内容，也不得在仓库中写入授权 Token、Measurement Protocol API Secret 或卡密。

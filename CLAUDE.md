# WeChat Read 项目规范

## 产品目标

把微信公众号文章可靠地保存为带 YAML Front Matter 的 Markdown 文件，并允许用户选择将图片一并本地归档。项目仅做本地浏览器扩展，不引入账号、后端或数据库。

## 技术约定

- Chrome Extension Manifest V3
- TypeScript + Vite，Popup 使用原生 DOM API
- 页面采集、领域模型、Markdown 转换、下载职责分离
- 所有站点采集器输出统一的 `Article` 类型
- Content Script 负责读取、清洗页面和注入隔离的快捷入口
- Background 负责跨域获取图片、ZIP 打包和下载
- Popup 负责设置归档偏好、触发操作和展示反馈
- “下载图片”默认关闭，用户偏好通过 `chrome.storage.local` 保存
- 图片归档失败不得静默丢图：保留网络地址并向用户报告失败数量
- 新增依赖前先确认原生浏览器 API 无法合理完成需求

## 目录约定

- `src/content/`：页面识别、微信公众号 DOM 提取与清洗
- `src/background/`：图片下载、ZIP 归档与浏览器下载
- `src/core/`：领域类型、Markdown 转换、文件名与 Front Matter
- `src/popup/`：用户界面和消息编排
- `public/`：Manifest 与静态资源
- `tests/`：与源码结构对应的单元测试
- `dist/`：构建产物，不提交 Git

## 质量门槛

- 修改后运行 `npm test` 和 `npm run build`
- UI 必须有加载、成功、不支持和失败状态
- 页面快捷入口必须使用 Shadow DOM 隔离，且支持键盘焦点
- 文件名必须兼容 Windows/macOS
- 不记录或上传文章内容
- 提交前检查 `git status`，只提交当前任务文件

## Git 约定

- Commit message 使用简洁英文，描述变更意图
- 不自动 push
- 不提交 `node_modules/`、`dist/`、日志或编辑器配置

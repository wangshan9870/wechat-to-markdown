# 微信文章存档

一个本地优先、无后端的 Chrome 扩展，把微信公众号文章保存成带 Front Matter 的 Markdown 文件。

## V0.1 能力

- 识别微信公众号文章页
- 提取标题、公众号、作者、发布时间和正文
- 清理广告、脚本与微信排版属性
- 保留链接、图片、列表、引用、表格等 Markdown 语义
- 使用兼容 Windows/macOS 的文件名下载 `.md`
- 所有处理都在本地浏览器中完成

## 开发

```bash
npm install
npm test
npm run build
```

## 安装到 Chrome

1. 运行 `npm run build`
2. 打开 `chrome://extensions`
3. 开启“开发者模式”
4. 点击“加载已解压的扩展程序”
5. 选择本项目的 `dist` 目录

之后打开一篇 `mp.weixin.qq.com` 文章，点击扩展图标并选择“保存 Markdown”。

## 目录

```text
src/content/  微信页面识别、提取与清洗
src/core/     领域类型、Markdown 和文件名规则
src/popup/    扩展交互界面
tests/        单元测试
```

## 下一版本

V0.2 将图片下载到 `images/` 并与 Markdown 一起打包为 ZIP。该功能需要处理微信 CDN 请求权限，不属于当前版本。

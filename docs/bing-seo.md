# Bing SEO 与 IndexNow

官网由 Cloudflare Pages 托管静态 `site/`。本页记录抓取信号、IndexNow 操作和仍需人工完成的 Bing Webmaster 步骤。

## 已落地（代码）

- 全站内容图使用描述性中文 `alt`；页眉品牌图标为装饰图 `alt=""`；英文 FAQ 块使用英文表述。
- 正式页面保持唯一 title / description、单一 H1、自引用 canonical、OG 基础标签。
- `site/robots.txt` 允许 `*`、`Bingbot`、`msnbot` 与 `Slurp`，并指向 `https://wx2md.com/sitemap.xml`。
- `site/sitemap.xml` 只列出本仓库正式可索引页，并为产品截图补充 image 条目。
- 首页 JSON-LD 使用 `@graph` 同时描述 `SoftwareApplication`、`WebSite` 和与可见 FAQ 一致的 `FAQPage`。
- IndexNow 密钥文件：`site/ff61dfbf92acc756a9b46973cd29c235.txt`
- 提交脚本：`npm run submit:indexnow`（`npm run deploy:site` 成功后也会尝试提交；失败不阻断部署）

## 部署后自检

1. `https://wx2md.com/robots.txt` 返回 200，含 `Sitemap: https://wx2md.com/sitemap.xml` 与 `User-agent: Bingbot`。
2. `https://wx2md.com/sitemap.xml` 返回 200，且每个 `<loc>` 都能打开对应正式页。
3. `https://wx2md.com/ff61dfbf92acc756a9b46973cd29c235.txt` 返回与文件名相同的密钥。

当前生产环境曾出现一份列出 `/en/`、`/faq/`、`/about/`、`/terms/` 的 sitemap；这些 URL **不在本仓库**。本仓库 sitemap 只收录 `scripts/check-site.mjs` 登记的正式页。若那些页面来自另一次手动部署，合并本分支后会被 `site/` 覆盖，请不要把未进仓的 URL 继续提交给 Bing。

## 人工门槛：Bing Webmaster Tools

代码无法代替站长账号授权。请用域名持有者账号完成：

1. 打开 [Bing Webmaster Tools](https://www.bing.com/webmasters) 并添加 `https://wx2md.com`。
2. 按提示完成所有权验证（DNS / meta / XML 文件均可；不要把验证密钥提交进仓库，除非改用本页已有的公开 IndexNow 文件）。
3. 提交 sitemap：`https://wx2md.com/sitemap.xml`。
4. 在“URL 检查 / 抓取控制”里抽查首页、`/wechat-to-markdown/`、`/wechat-to-obsidian/`、`/privacy/`。
5. 监测查询：`微信公众号 转 Markdown`、`WeChat to Markdown`、`公众号 Obsidian`、`wx2md`。
6. 图片搜索可抽查产品截图的中文描述，例如“公众号文章 保存 Markdown 按钮”。

## IndexNow 轮换

IndexNow 密钥本身就是公开文件，不要把它当成私密 Token。需要轮换时：

1. `openssl rand -hex 16` 生成新密钥。
2. 删除旧的 `site/<old-key>.txt`，新增 `site/<new-key>.txt`，内容与文件名一致。
3. 更新 `site/_headers` 里对应的密钥路径。
4. 部署官网，再运行 `npm run submit:indexnow`。
5. 旧密钥可立即失效，无需通知 Bing 之外的第三方。

单独预演提交列表（不请求接口）：

```bash
npm run submit:indexnow -- --dry-run
```

## 说法边界

结构化数据和营销文案必须与页面可见内容一致：

- 单篇导出长期免费；不要写“每月 10 次”等本仓库未承诺的额度。
- 单篇文章解析与打包在浏览器本地完成，不把正文上传到运营者服务器。
- 授权服务仍会接收卡密/邮箱与设备信息；官网 GA4 只统计净化后的页面路径。
- 普通网页支持是次级能力，不得改写为全网万能剪藏工具。

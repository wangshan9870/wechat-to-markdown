# Bing 与 IndexNow

正式官网是 https://wx2md.com 。抓取文件（`robots.txt`、`sitemap.xml`、IndexNow 密钥）和站点部署都在独立的站点仓库，不在本仓库。

不要根据本仓库恢复这些文件，也不要从这里向 Cloudflare Pages 发布。本仓库曾经的一份 sitemap 少于线上页面，继续提交会和 https://wx2md.com/sitemap.xml 冲突。

## 站长账号里仍需人工完成

1. 打开 [Bing Webmaster Tools](https://www.bing.com/webmasters) 并添加 `https://wx2md.com`。
2. 按提示完成所有权验证。验证材料留在站长账号或站点仓库，不要把新的密钥提交进本仓库。
3. 提交线上 sitemap：`https://wx2md.com/sitemap.xml`。
4. 抽查首页以及站点仓库里实际存在的正式页面。

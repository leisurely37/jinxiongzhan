# 🐻 金熊站上线部署指南（Netlify 免费方案）

> 目标：固定网址、**0 元**、**不需要信用卡**、重启不丢数据。

## 现状（你已经完成的部分）

| 项目 | 状态 |
| --- | --- |
| Supabase 项目 `dsmmazsshwqzecicbgso` | ✅ 已建好 |
| 6 张表 + `uploads` 存储桶 | ✅ 已建好，桶为 public |
| 旧数据导入（7 个账号 / 6 篇帖子 / 4 评论 / 3 赞） | ✅ 已导入 |
| GitHub 仓库 `leisurely37/jinxiongzhan` | ✅ 已创建（还差几个新文件，见第 1 步） |
| Render 部署 | ❌ 新账号强制绑卡，已放弃 |

**剩下的只有：补传几个新文件 + 在 Netlify 点一次导入。**

---

## 架构

```
浏览器
  ├── 静态页面   Netlify CDN  ← public/index.html + app.js
  └── /api/*     Netlify Function  ← netlify/functions/api.js → Express
                        │
                        └── Supabase（Postgres 数据库 + Storage 文件）
```

---

## 第 1 步：把新文件补传到 GitHub

这次改造新增/修改了以下文件，**必须上传后 Netlify 才能正常运行**：

- 新增：`app.js`、`netlify.toml`、`netlify/functions/api.js`
- 修改：`server.js`、`package.json`、`package-lock.json`、`public/app.js`
- 文档：`README.md`、`DEPLOY.md`

**已经帮你整理好一个干净的文件夹**（不含 node_modules）：

```
C:\Users\35738\Desktop\金熊站-上传到GitHub
```

操作：

1. 打开 https://github.com/leisurely37/jinxiongzhan/upload/main
2. 打开上面那个文件夹，按 `Ctrl + A` 全选，把**所有文件和文件夹**拖进浏览器
3. 等列表出现 `app.js`、`netlify.toml`、`netlify/functions/api.js` 等
4. 点 **Commit changes**

> 同名文件会被覆盖，没有的文件会新建，不会产生重复。
> 这个文件夹只是用来上传的，传完可以删掉。

---

## 第 2 步：在 Netlify 导入仓库

1. 打开 https://app.netlify.com/signup
2. 点 **Sign up with GitHub** → **Authorize**
3. 登录后点 **Add new site** → **Import an existing project**
4. 选 **GitHub** → 授权 → 选择仓库 **`leisurely37/jinxiongzhan`**
5. 构建设置页面：
   - **Build command**：保留 `npm install`（`netlify.toml` 已写好，如果显示别的就改成这个）
   - **Publish directory**：`public`
6. 展开 **Environment variables**，加两条：

   | Key | Value |
   | --- | --- |
   | `SUPABASE_URL` | `https://dsmmazsshwqzecicbgso.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | 你的 `sb_secret_...` |

7. 点 **Deploy site**，等 1～3 分钟

部署成功后 Netlify 会给你一个网址，形如：

```
https://random-name-123456.netlify.app
```

## 第 3 步：把网址改好看（可选）

1. 站点页面 → **Site configuration** → **Site details** → **Change site name**
2. 填 `jinxiong`（或 `jinxiong-bear` 之类没被占用的）
3. 网址就变成 **`https://jinxiong.netlify.app`**

---

## 第 4 步：验证

- [ ] 打开网址，能看到「欢迎加入金熊站 🐻」
- [ ] 能看到原来的 6 篇帖子
- [ ] 注册新账号 → 登录成功
- [ ] 发一条带图片的帖子 → 图片正常显示
- [ ] 评论、点赞、改头像都正常
- [ ] 手机流量访问也能打开

---

## ⚠️ Netlify 免费版的三个限制

| 限制 | 影响 | 应对 |
| --- | --- | --- |
| 单次请求体 ≤ 6MB | 一次上传的文件总量不能超过 5MB | 前端已自动把图片压缩到 1600px，手机照片通常压到 300KB 左右；视频请先发 B 站再贴链接 |
| 函数冷启动 | 一段时间没人访问，第一次打开会慢 2～5 秒 | 正常，之后很快 |
| 函数执行 10 秒超时 | 极大的文件上传可能超时 | 5MB 以内不会触发 |

其他额度：每月 100GB 流量、12.5 万次函数调用、300 分钟构建时间——小社区完全够用。

---

## 常见问题

**1. 部署后首页能开，但帖子列表一直加载**
环境变量没生效。检查 Netlify → **Site configuration** → **Environment variables**，确认名字是 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，值没有空格；改完点 **Deploys → Trigger deploy → Deploy site** 重新部署。

**2. 提示 `Functions bundling failed`**
`netlify/functions/api.js` 或 `app.js` 没传上去。回到第 1 步检查这两个文件在不在仓库里。

**3. 发帖报「文件总大小不能超过 5MB」**
正常提示。减少图片数量，或者换更小的图片（前端会自动压缩，但总量仍受 5MB 限制）。

**4. 上传图片后图片 404**
Supabase 的 `uploads` 桶被设成了 private。到 Supabase → Storage → `uploads` → Settings，打开 **Public bucket**。

**5. 想换成自己的域名**
Netlify → **Domain management** → **Add a domain**。域名需要自己买（约 ¥30～80/年），Netlify 自动签 HTTPS 证书，不需要备案。

**6. 以后想改页面**
改 GitHub 上的 `public/index.html` 或 `public/app.js`，提交后 Netlify 会自动重新部署（1～2 分钟）。

---

## 附录：其他部署方式

### Render（需要 Visa/Mastercard）
仓库里已经放好 `render.yaml`，如果以后有了能绑的卡：
New + → Blueprint → 选仓库 → 填两个环境变量 → Apply。
免费实例 15 分钟无访问会休眠，首次打开约 1 分钟。

### 国内云服务器（最快最稳，约 ¥50～150/年）
买一台腾讯云/阿里云轻量服务器（支付宝即可，不需要信用卡），配置 Node 18+，
把代码传上去后 `npm install && npm start`，再用 PM2 做开机自启。
这条路没有 6MB 限制、不会休眠、国内访问最快，需要的话我可以远程帮你装。

---

## Supabase 初始化（已完成，仅备查）

如果以后要重建数据库：

1. SQL Editor 执行 `supabase/schema.sql`（建 6 张表 + `uploads` 桶）
2. SQL Editor 执行 `data/import-legacy.sql`（导入旧数据）
3. Settings → API Keys 拿 **Project URL** 和 **Secret key**

> `data/import-legacy.sql` 含密码哈希，**不要上传到 GitHub**。

# 🐻 金熊站上线部署指南

> 目标：把这个网站在**零成本、无需服务器、无需信用卡**的前提下放到公网，
> 得到一个**固定的网址**，所有人都能打开、注册、发帖，而且**重启不会丢数据**。

---

## 一、最终你会得到什么

| 项目 | 结果 |
| --- | --- |
| 网址 | `https://jinxiong-community.onrender.com`（固定不变，创建后就是这个） |
| 费用 | 0 元 |
| 域名 | 平台免费二级域名；以后想用自己的域名也可以免费绑定 |
| 数据 | 存在 Supabase 云端数据库，重启 / 重新部署都不会丢 |
| 图片 | 存在 Supabase 云端文件存储，永久可访问 |
| 维护 | 改代码后自动重新部署 |

**架构只有三块：**

```
GitHub（放代码）  →  Render（运行网站，给你网址）  →  Supabase（存数据 + 存图片）
```

> ⚠️ 为什么必须用 Supabase？
> Render 免费实例的硬盘是**临时的**，每次重启、休眠唤醒、重新部署都会清空。
> 如果不把数据放到 Supabase，你的帖子和账号会不断消失。

---

## 二、准备三个免费账号（都不需要信用卡）

| 平台 | 注册地址 | 说明 |
| --- | --- | --- |
| GitHub | https://github.com/signup | 只用来存代码，邮箱注册即可 |
| Supabase | https://supabase.com/dashboard | 点 **Sign in with GitHub** 一键登录，不用再注册 |
| Render | https://dashboard.render.com/register | 点 **Sign in with GitHub** 一键登录，不用再注册 |

> 如果注册时要求人机验证 / 手机号，按页面提示完成即可，三个平台都**不需要填写银行卡**。

---

## 三、第一步：把代码放到 GitHub

1. 打开 https://github.com/new
2. **Repository name** 填 `jinxiong-community`
3. 选择 **Public**（公开仓库，免费；代码里没有任何密钥）
4. **不要**勾选 "Add a README file"
5. 点绿色按钮 **Create repository**

创建后会看到一个空仓库页面，点其中的链接 **"uploading an existing file"**。

6. 打开你电脑上的文件夹：`C:\Users\35738\Desktop\金熊站`
7. 把下面这些**文件夹和文件**拖进浏览器的上传框：

   **文件夹（4 个）**
   - `lib`
   - `public`
   - `scripts`
   - `supabase`

   **文件（8 个）**
   - `server.js`
   - `package.json`
   - `package-lock.json`
   - `render.yaml`
   - `README.md`
   - `DEPLOY.md`
   - `.gitignore`
   - `.env.example`

8. 页面底部点 **Commit changes**，等它上传完。

> ❌ **绝对不要上传**：`node_modules`（几万个文件，会让上传失败）、`data`（你的本地数据和密码哈希）、`screenshot_small.jpg`。
> ✅ `public/uploads` 里的几个 `.svg` 头像传不传都行，不影响。

---

## 四、第二步：创建 Supabase 数据库（存数据 + 图片）

### 4.1 新建项目

1. 打开 https://supabase.com/dashboard ，用 GitHub 登录
2. 点 **New project**
3. 填写：
   - **Name**：`jinxiong`
   - **Database Password**：随便设一个强密码，**记下来**（后面其实用不到，但别丢）
   - **Region**：选 **Southeast Asia (Singapore)**（离国内最近）
4. 点 **Create new project**，等 1～2 分钟初始化完成

### 4.2 建表（30 秒）

1. 左侧菜单点 **SQL Editor**（图标像 `>_`）
2. 点 **New query**
3. 打开本地文件 `金熊站\supabase\schema.sql`，全选复制，粘贴进去
4. 点右下角 **Run**（或按 Ctrl+Enter）
5. 看到结果里出现 `金熊站数据库初始化完成 ✅` 就成功了

这一步会自动创建 6 张表，并且创建一个名为 `uploads` 的**公开**文件桶（用来存头像和帖子图片）。

### 4.3 导入你原来的帖子（可选，但推荐）

这样原来那 7 个账号、6 篇帖子、评论和点赞都会保留。

1. 还是 **SQL Editor** → **New query**
2. 打开本地文件 `金熊站\data\import-legacy.sql`，全选复制粘贴
3. 点 **Run**
4. 最后会显示 `users / posts / comments / likes` 的数量，能看到 7、6、4、3 就对了

> 这些旧账号的密码已自动转换成加密哈希，登录密码和原来一样（比如 `123456`）。

### 4.4 拿到两个密钥（关键）

1. 左下角 **Project Settings**（齿轮图标）→ **API**
2. 找到并复制这两项：

   - **Project URL**：形如 `https://abcdefghijklmnop.supabase.co`
   - **Project API keys** 里的 **`service_role`** → 点 **Reveal** 后复制（很长一串）

> 🔐 `service_role` 是最高权限的钥匙，**只能填到 Render 的环境变量里**。
> 不要写进代码、不要发到群里、不要提交到 GitHub。填错位置网站会被别人改数据。

---

## 五、第三步：在 Render 部署（拿到固定网址）

1. 打开 https://dashboard.render.com/register ，点 **Sign in with GitHub** 并授权
2. 右上角 **New +** → 选择 **Blueprint**
3. 在仓库列表里选择 `jinxiong-community` → **Connect**
4. Render 会自动读取仓库里的 `render.yaml`，显示一个名为 **jinxiong-community** 的服务：
   - Type: Web Service
   - Region: Singapore
   - Plan: **Free**
5. 因为配置里把两个密钥设置成了「创建时询问」，页面会让你填写：
   - `SUPABASE_URL` → 粘贴 4.4 里的 **Project URL**
   - `SUPABASE_SERVICE_ROLE_KEY` → 粘贴 4.4 里的 **service_role key**
6. 点 **Apply** / **Deploy Blueprint**
7. 等 2～5 分钟，看日志出现下面三行就是成功：

   ```
   🐻 金熊站社区已启动！
   💾 存储模式: Supabase 云端（数据持久）
   📦 文件存储: Supabase Storage / uploads
   ```

8. 页面顶部会显示你的网址：`https://jinxiong-community.onrender.com`

> 如果这个名字已被别人占用，Render 会自动加随机后缀，比如 `jinxiong-community-a1b2.onrender.com`。
> **这个网址就是你的固定地址**，以后一直用它。

<details>
<summary>如果 Blueprint 方式失败，用手动方式（点开）</summary>

1. **New +** → **Web Service** → 选择 `jinxiong-community` 仓库
2. 填写：
   - **Name**：`jinxiong-community`
   - **Region**：Singapore
   - **Branch**：`main`
   - **Runtime**：Node
   - **Build Command**：`npm install`
   - **Start Command**：`npm start`
   - **Instance Type**：**Free**
3. 页面下方 **Environment Variables** 添加两条：
   - `SUPABASE_URL` = 你的 Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = 你的 service_role key
4. **Create Web Service**，等构建完成
</details>

---

## 六、第四步：验证（很重要，逐条走一遍）

用手机流量和电脑各打开一次网址，确认：

- [ ] 首页能看到「欢迎加入金熊站 🐻」这条帖子（说明数据库已连上）
- [ ] 能注册新账号、能登录
- [ ] 能发帖，能上传一张图片并正常显示（说明文件存储正常）
- [ ] 能评论、点赞、改昵称、换头像
- [ ] 换一个浏览器 / 用手机能搜到刚发的帖子（说明是真正的公网服务）

**验证数据是否真的持久化：**

1. 在 Render 页面右上角点 **Manual Deploy** → **Deploy latest commit**
2. 等它重新部署完成（2 分钟左右）
3. 刷新网址，刚才发的帖子和账号**还在** → 说明持久化成功 ✅

如果帖子消失了，说明环境变量没生效，回去检查 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`。

---

## 七、第五步（可选）：让它更快、更好记

### 7.1 消除「第一次打开要等 1 分钟」

免费实例 **15 分钟没人访问就会休眠**，再次访问需要 30～60 秒唤醒。两种做法：

**方法 A（免费，推荐）**：用免费监控定时访问，让它保持清醒
1. 注册 https://uptimerobot.com （免费）
2. **Add New Monitor** → Monitor Type 选 `HTTP(s)`
3. URL 填 `https://你的地址.onrender.com/api/health`
4. Monitoring Interval 选 **10 minutes**
5. 保存

> 注意：Render 免费套餐每个工作区每月 750 实例小时，全天挂着约 720 小时，刚好够用。

**方法 B**：升级 Render 付费实例（约 $7/月），彻底不休眠。不着急可以不做。

### 7.2 绑定自己的域名（可选，约 ¥30～80/年）

1. 到任意域名商（阿里云 / 腾讯云 / Cloudflare）买一个域名，例如 `jinxiong.com`
2. Render → 你的服务 → **Settings** → **Custom Domains** → **Add Custom Domain**
3. 输入域名，按提示到域名商添加一条 **CNAME** 记录指向 `你的地址.onrender.com`
4. 等 10 分钟～2 小时，Render 会自动签发 HTTPS 证书

> 国内服务器绑定域名需要备案，但 Render 是海外服务，**不需要备案**。

### 7.3 想在国内访问更稳？

`onrender.com` 在国内网络下偶尔会慢或打不开（不是网站的问题）。彻底稳定的办法是换成国内云服务器（约 ¥50～150/年），
需要的话告诉我，我可以把这套代码直接迁移过去（数据不用重做）。

---

## 八、日常维护

| 想做什么 | 怎么做 |
| --- | --- |
| 改首页文案 / 样式 | GitHub 打开 `public/index.html` → 右上角铅笔图标 → 修改 → **Commit changes** → Render 自动重新部署 |
| 看运行日志 | Render → 你的服务 → **Logs** |
| 备份数据 | Supabase → **Table Editor** → 选择表 → 右上角导出 CSV |
| 手动重新部署 | Render → **Manual Deploy** → **Deploy latest commit** |
| 重启服务 | Render → 右上 **Restart service** |

**改代码后多久生效？** 提交到 GitHub 后，Render 会自动拉取并重新部署，约 2～3 分钟。

---

## 九、常见问题

**1. 第一次打开特别慢（30～60 秒），之后正常**
免费实例休眠了，属正常现象。按 7.1 装个免费监控保活即可。

**2. 图片显示不出来 / 头像是空白**
- Supabase → **Storage** 里看不到 `uploads` 桶：说明 `schema.sql` 没执行成功，重新执行一次。
- 桶存在但不是 Public：Storage → `uploads` → Settings → 打开 **Public bucket**。

**3. 页面报「服务器出错了」或「Supabase ... 401」**
- 环境变量名必须是 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`
- 值不能有空格、不能带引号
- key 必须是 **service_role**，用 anon key 会 401

**4. Render 构建失败：`Cannot find module './lib/...'`**
GitHub 里少传了 `lib` 或 `scripts` 文件夹，补传后重新部署。

**5. 部署成功但数据总是丢失**
说明网站正在用本地 JSON 而不是 Supabase：Render → **Environment** 检查两个变量是否真的存在，改完要 **Save** 并重新部署。

**6. Supabase 项目被暂停了**
免费项目**连续 7 天完全没有访问**会自动暂停。登录 Supabase，点 **Restore project** 即可恢复，数据不会丢。
（网站有人用就不会触发。）

**7. 上传视频失败**
Render 免费实例只有 512MB 内存，建议单个文件控制在 20MB 以内；大视频建议先发到 B 站/YouTube 再贴链接。

**8. 微信里打开提示「非官方网页」**
这是微信对第三方域名的常规提示，点「继续访问」即可，不影响使用。

---

## 十、安全说明

- 密码用 **scrypt + 随机盐**哈希后存储，数据库里看不到明文（旧数据的明文密码在登录时也会自动升级为哈希）。
- `service_role` 密钥只存在于 Render 的服务端环境变量，前端代码里没有任何密钥。
- 登录状态有效期 30 天，退出登录会立即销毁会话。
- 已内置基础限流（登录、注册、发帖、评论、私信），防止脚本刷屏。
- 这是一个公开社区，请提醒使用者不要发布违法或侵权内容；如果要限制注册（比如加邀请码），告诉我可以加上。

---

## 卡住了怎么办？

把**出错的页面截图**或 **Render 日志里的红字**发给我，我帮你判断是哪一步的问题。

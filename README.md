# 🐻 金熊站 - 综合兴趣社区论坛

一个类似贴吧的公共社区网站，分为艺术、生活、学术、娱乐四大板块，支持发帖、评论、点赞、私聊等功能。

**本版本已改造为可公网部署：固定网址、免费、数据持久保存。部署步骤见 [DEPLOY.md](DEPLOY.md)。**

## ✨ 功能特性

- **四大分区**：艺术 🎨、生活 🌿、学术 📚、娱乐 🎮
- **发帖功能**：支持文字、图片、视频、各类文件附件上传（单文件 50MB，最多 10 个）
- **互动功能**：评论、点赞、私信聊天
- **个人主页**：自定义昵称、头像、个人简介
- **搜索功能**：按标题和内容搜索帖子，支持分类过滤
- **响应式设计**：适配电脑和手机端

## 🏗 架构

```
浏览器
  │
  ├── 静态页面  public/index.html + app.js
  │
  └── /api/*  ──►  Node.js（Express）server.js
                        │
                        ├── 数据层 lib/store-*.js  ──►  Supabase Postgres（云端，持久）
                        └── 文件层 lib/storage.js  ──►  Supabase Storage（云端，持久）
```

- **线上**：配置了 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`，数据与文件全部存云端，实例重启/重新部署都不丢。
- **本地**：不配置这两个变量时，自动退回 `data/data.json` + `public/uploads/`，方便没网也能预览。

## 🚀 本地运行

```bash
npm install
npm start
# 打开 http://localhost:3000
```

## ☁️ 公网部署（免费）

完整图文步骤见 **[DEPLOY.md](DEPLOY.md)**，大致三步：

1. 代码上传到 GitHub
2. Supabase 新建项目 → 执行 `supabase/schema.sql`（可选再执行 `data/import-legacy.sql` 导入旧数据）
3. Render 用 Blueprint 部署，填两个环境变量 → 得到固定网址

## 📁 项目结构

```
金熊站/
├── server.js               # Express 服务与全部 API 路由
├── lib/
│   ├── config.js           # 运行模式判断（云端 / 本地）
│   ├── store.js            # 数据层入口（自动选择后端）
│   ├── store-supabase.js   # Supabase PostgREST + Storage 实现
│   ├── store-local.js      # 本地 JSON 实现（仅预览用）
│   ├── storage.js          # 文件上传（云端 / 本地）
│   ├── auth.js             # scrypt 密码哈希、会话令牌
│   ├── avatar.js           # 默认头像（SVG data URI）
│   ├── seed.js             # 空库时自动创建欢迎帖
│   └── env.js              # .env 读取
├── public/
│   ├── index.html          # 页面结构与样式
│   ├── app.js              # 前端逻辑
│   └── uploads/            # 本地上传目录（本地模式使用）
├── supabase/schema.sql     # 云端建表 + 文件桶初始化
├── scripts/
│   ├── preflight.js        # 上线自检（检查环境变量、数据库、文件桶）
│   └── seed.js             # 把本地 data/data.json 迁移到 Supabase
├── data/                   # 本地数据库（不提交到仓库）
├── render.yaml             # Render 一键部署配置
└── DEPLOY.md               # 部署指南
```

## 🔌 API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/me` | 当前登录用户 |
| POST | `/api/login` / `/api/register` / `/api/logout` | 登录 / 注册 / 退出 |
| GET | `/api/unread-count` | 未读私信数 |
| GET | `/api/posts` | 帖子列表（`category` / `page` / `limit`） |
| GET | `/api/post/:id` | 帖子详情 + 评论 |
| POST | `/api/post` | 发帖（multipart） |
| DELETE | `/api/post/:id` | 删除自己的帖子 |
| POST | `/api/like/:postId` | 点赞 / 取消点赞 |
| POST | `/api/comment` · DELETE `/api/comment/:id` | 发表 / 删除评论 |
| GET | `/api/user/:id` · `/api/user/:id/posts` | 用户资料 / 用户帖子 |
| POST | `/api/user/avatar` · PUT `/api/user/nickname` | 换头像 / 改昵称 |
| GET | `/api/messages` · `/api/messages/:userId` | 会话列表 / 聊天记录 |
| POST | `/api/message` | 发私信 |
| GET | `/api/search?q=` | 搜索帖子 |

## ⚙️ 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SUPABASE_URL` | 线上必填 | 形如 `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | 线上必填 | Supabase 服务端密钥（**不要泄露**） |
| `SUPABASE_BUCKET` | 否 | 文件桶名，默认 `uploads` |
| `PORT` | 否 | 端口，默认 3000（平台会自动注入） |

本地可复制 `.env.example` 为 `.env` 填写。上线前可运行 `npm run preflight` 自检。

## 🛠 技术栈

- **后端**：Node.js 18+ / Express 4
- **存储**：Supabase（Postgres + Storage），零额外 SDK（直接调用 REST API）
- **前端**：原生 HTML/CSS/JavaScript
- **安全**：scrypt 加盐哈希、会话过期、限流、安全响应头

---

🐻 金熊站 - 分享你的兴趣，连接同好

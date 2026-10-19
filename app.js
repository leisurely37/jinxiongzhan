require('./lib/env')();

const express = require('express');
const multer = require('multer');
const path = require('path');

const config = require('./lib/config');
const store = require('./lib/store');
const fileStorage = require('./lib/storage');
const { hashPassword, verifyPassword, newToken, newId } = require('./lib/auth');
const { defaultAvatar } = require('./lib/avatar');
const { ensureWelcomePost } = require('./lib/seed');

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');

// 单文件上限：Serverless（Netlify）请求体限制约 6MB，默认 5MB 留出余量
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 5;
const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024;
const MAX_FILES = 10;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 登录有效期 30 天
const CATEGORIES = new Set(['art', 'life', 'academic', 'entertainment']);
const MEDIA_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp4', '.webm', '.mov', '.ogg']);

// ==================== 基础中间件 ====================
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

// 请求体上限保护：Serverless 平台本身限制约 6MB，这里提前给出中文提示
const MAX_BODY_MB = Number(process.env.MAX_BODY_MB) || 6;
app.use('/api', (req, res, next) => {
  const length = Number(req.headers['content-length'] || 0);
  if (length > MAX_BODY_MB * 1024 * 1024) {
    return res.status(413).json({
      error: '一次上传的文件总大小不能超过 ' + MAX_FILE_MB + 'MB，请压缩后重试',
    });
  }
  next();
});

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(
  express.static(PUBLIC_DIR, {
    index: 'index.html',
    setHeaders(res, filePath) {
      if (/\.(html|js|css)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    },
  })
);

// ==================== 工具函数 ====================
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function clean(value, max) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, max);
}

function publicUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

async function authUser(req) {
  if (req._authResolved) return req._authUser;
  req._authResolved = true;
  req._authUser = null;

  const token = req.headers.authorization;
  if (!token || typeof token !== 'string') return null;

  const session = await store.getSession(token.replace(/^Bearer\s+/i, '').trim());
  if (!session) return null;

  const createdAt = new Date(session.created_at).getTime();
  if (Number.isFinite(createdAt) && Date.now() - createdAt > SESSION_TTL_MS) {
    await store.deleteSession(session.token).catch(() => {});
    return null;
  }

  const user = await store.getUserById(session.user_id);
  req._authUser = user || null;
  return req._authUser;
}

async function decoratePosts(posts, viewer) {
  if (!posts || !posts.length) return [];
  const ids = posts.map(p => p.id);
  const userIds = [...new Set(posts.map(p => p.user_id))];

  const [users, likeMap, commentMap, likedSet] = await Promise.all([
    store.getUsersByIds(userIds),
    store.countLikesByPost(ids),
    store.countCommentsByPost(ids),
    viewer ? store.getLikedPostIds(viewer.id, ids) : Promise.resolve(new Set()),
  ]);

  const userMap = new Map((users || []).map(u => [u.id, u]));

  return posts.map(p => {
    const u = userMap.get(p.user_id);
    return {
      ...p,
      nickname: u ? u.nickname : '已注销用户',
      avatar: u ? u.avatar : defaultAvatar('?'),
      like_count: likeMap.get(p.id) || 0,
      comment_count: commentMap.get(p.id) || 0,
      userLiked: likedSet.has(p.id),
    };
  });
}

function normalizeMessage(m) {
  return { ...m, read: m.is_read, is_read: undefined };
}

// 简易限流（单实例内存计数，足够应对小社区）
const rateBuckets = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = req.method + ' ' + req.path + ' ' + ip;
    const now = Date.now();
    let bucket = rateBuckets.get(key);
    if (!bucket || bucket.reset < now) {
      bucket = { count: 0, reset: now + windowMs };
      rateBuckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({ error: '操作太频繁，请稍后再试' });
    }
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.reset < now) rateBuckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

// ==================== 上传配置 ====================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
});

// ==================== 健康检查 ====================
app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: config.storageMode, time: new Date().toISOString() });
});

// ==================== 账号 ====================
app.get('/api/me', ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '未登录' });
  res.json({ user: publicUser(user) });
}));

app.post('/api/login', rateLimit(30, 10 * 60 * 1000), ah(async (req, res) => {
  const nickname = clean(req.body.nickname, 40);
  const password = String(req.body.password || '');
  if (!nickname || !password) return res.status(400).json({ error: '请填写昵称和密码' });

  const user = await store.getUserByNickname(nickname);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const result = verifyPassword(password, user.password);
  if (!result.ok) return res.status(401).json({ error: '密码错误' });

  // 旧数据里的明文密码，登录成功后自动升级为哈希
  if (result.legacy) {
    await store.updateUser(user.id, { password: hashPassword(password) }).catch(() => {});
  }

  const token = newToken();
  await store.createSession({ token, user_id: user.id, created_at: new Date().toISOString() });
  res.json({ token, user: publicUser(user) });
}));

app.post('/api/register', rateLimit(20, 10 * 60 * 1000), ah(async (req, res) => {
  const nickname = clean(req.body.nickname, 20);
  const password = String(req.body.password || '');

  if (!nickname || !password) return res.status(400).json({ error: '请填写昵称和密码' });
  if (password.length < 3) return res.status(400).json({ error: '密码至少 3 位' });
  if (password.length > 64) return res.status(400).json({ error: '密码最长 64 位' });
  if (/[\u0000-\u001f]/.test(nickname)) return res.status(400).json({ error: '昵称包含非法字符' });

  const existing = await store.getUserByNickname(nickname);
  if (existing) return res.status(409).json({ error: '昵称已被使用' });

  const user = await store.createUser({
    id: newId(),
    nickname,
    password: hashPassword(password),
    avatar: defaultAvatar(nickname),
    bio: '',
    created_at: new Date().toISOString(),
  });

  const token = newToken();
  await store.createSession({ token, user_id: user.id, created_at: new Date().toISOString() });
  res.json({ token, user: publicUser(user) });
}));

app.post('/api/logout', ah(async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (token) await store.deleteSession(token).catch(() => {});
  res.json({ success: true });
}));

app.get('/api/unread-count', ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.json({ count: 0 });
  const count = await store.unreadCount(user.id);
  res.json({ count });
}));

// ==================== 帖子 ====================
app.get('/api/posts', ah(async (req, res) => {
  const category = String(req.query.category || 'all');
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const viewer = await authUser(req);

  const { posts, total } = await store.listPosts({
    category,
    offset: (page - 1) * limit,
    limit,
  });

  const decorated = await decoratePosts(posts, viewer);
  res.json({
    posts: decorated,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}));

app.get('/api/post/:id', ah(async (req, res) => {
  const viewer = await authUser(req);
  const post = await store.getPost(req.params.id);
  if (!post) return res.status(404).json({ error: '帖子不存在' });

  const [decorated] = await decoratePosts([post], viewer);
  const comments = await store.listComments(post.id);
  const commentUsers = await store.getUsersByIds([...new Set(comments.map(c => c.user_id))]);
  const userMap = new Map(commentUsers.map(u => [u.id, u]));

  res.json({
    post: decorated,
    comments: comments.map(c => {
      const u = userMap.get(c.user_id);
      return {
        ...c,
        nickname: u ? u.nickname : '已注销用户',
        avatar: u ? u.avatar : defaultAvatar('?'),
      };
    }),
  });
}));

app.post('/api/post', rateLimit(60, 60 * 60 * 1000), upload.array('files', MAX_FILES), ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  const category = CATEGORIES.has(req.body.category) ? req.body.category : 'life';
  const title = clean(req.body.title, 100);
  const content = clean(req.body.content, 20000);
  if (!title || !content) return res.status(400).json({ error: '请填写标题和内容' });

  const images = [];
  const files = [];

  for (const file of req.files || []) {
    const ext = fileStorage.extOf(file.originalname);
    const saved = await fileStorage.upload({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      kind: 'attachments',
    });
    if (MEDIA_EXT.has(ext)) {
      images.push(saved.url);
    } else {
      files.push({ name: file.originalname, url: saved.url, size: saved.size });
    }
  }

  const postId = newId();
  await store.createPost({
    id: postId,
    user_id: user.id,
    category,
    title,
    content,
    images,
    files,
    created_at: new Date().toISOString(),
  });

  res.json({ success: true, postId });
}));

app.delete('/api/post/:id', ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  const post = await store.getPost(req.params.id);
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  if (post.user_id !== user.id) return res.status(403).json({ error: '无权限删除' });

  await store.deletePost(post.id);
  res.json({ success: true });
}));

// ==================== 点赞 ====================
app.post('/api/like/:postId', ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  const post = await store.getPost(req.params.postId);
  if (!post) return res.status(404).json({ error: '帖子不存在' });

  const liked = await store.isLiked(post.id, user.id);
  if (liked) {
    await store.removeLike(post.id, user.id);
  } else {
    await store.addLike({
      id: newId(),
      user_id: user.id,
      post_id: post.id,
      created_at: new Date().toISOString(),
    });
  }

  const map = await store.countLikesByPost([post.id]);
  res.json({ liked: !liked, likeCount: map.get(post.id) || 0 });
}));

// ==================== 评论 ====================
app.post('/api/comment', rateLimit(120, 10 * 60 * 1000), ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  const postId = clean(req.body.postId, 60);
  const content = clean(req.body.content, 1000);
  if (!content) return res.status(400).json({ error: '评论内容不能为空' });

  const post = await store.getPost(postId);
  if (!post) return res.status(404).json({ error: '帖子不存在' });

  await store.createComment({
    id: newId(),
    post_id: post.id,
    user_id: user.id,
    content,
    created_at: new Date().toISOString(),
  });

  res.json({ success: true });
}));

app.delete('/api/comment/:id', ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  const comment = await store.getComment(req.params.id);
  if (!comment) return res.status(404).json({ error: '评论不存在' });
  if (comment.user_id !== user.id) return res.status(403).json({ error: '无权限删除' });

  await store.deleteComment(comment.id);
  res.json({ success: true });
}));

// ==================== 用户主页 ====================
app.get('/api/user/:id', ah(async (req, res) => {
  const user = await store.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const [postCount, likeCount] = await Promise.all([
    store.countPostsByUser(user.id),
    store.countLikesForUserPosts(user.id),
  ]);

  res.json({ user: { ...publicUser(user), postCount, likeCount } });
}));

app.get('/api/user/:id/posts', ah(async (req, res) => {
  const posts = await store.listPostsByUser(req.params.id);
  const decorated = await decoratePosts(posts, null);
  res.json({
    posts: decorated.map(p => ({
      ...p,
      nickname: undefined,
      avatar: undefined,
      userLiked: undefined,
    })),
  });
}));

app.post('/api/user/avatar', upload.single('avatar'), ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });
  if (!req.file) return res.status(400).json({ error: '请选择图片' });

  const ext = fileStorage.extOf(req.file.originalname);
  if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
    return res.status(400).json({ error: '头像只支持 jpg / png / gif / webp 图片' });
  }

  const saved = await fileStorage.upload({
    buffer: req.file.buffer,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    kind: 'avatars',
  });

  await store.updateUser(user.id, { avatar: saved.url });
  res.json({ avatar: saved.url });
}));

app.put('/api/user/nickname', ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  const nickname = clean(req.body.nickname, 20);
  if (!nickname) return res.status(400).json({ error: '昵称不能为空' });
  if (/[\u0000-\u001f]/.test(nickname)) return res.status(400).json({ error: '昵称包含非法字符' });

  const existing = await store.getUserByNickname(nickname);
  if (existing && existing.id !== user.id) return res.status(409).json({ error: '昵称已被使用' });

  await store.updateUser(user.id, { nickname });
  res.json({ success: true });
}));

// ==================== 私信 ====================
app.get('/api/messages', ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  const all = await store.listMessagesForUser(user.id);
  const byOther = new Map();

  all.forEach(m => {
    const otherId = m.from_user_id === user.id ? m.to_user_id : m.from_user_id;
    if (!byOther.has(otherId)) {
      byOther.set(otherId, { other_id: otherId, last_message: m.content, unread: 0 });
    }
    if (m.from_user_id === otherId && m.to_user_id === user.id && !m.is_read) {
      byOther.get(otherId).unread += 1;
    }
  });

  const otherUsers = await store.getUsersByIds([...byOther.keys()]);
  const userMap = new Map(otherUsers.map(u => [u.id, u]));

  const conversations = [...byOther.values()].map(c => {
    const u = userMap.get(c.other_id);
    return {
      ...c,
      nickname: u ? u.nickname : '已注销用户',
      avatar: u ? u.avatar : defaultAvatar('?'),
    };
  });

  res.json({ conversations });
}));

app.get('/api/messages/:userId', ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  const messages = await store.listConversation(user.id, req.params.userId);
  await store.markConversationRead(req.params.userId, user.id).catch(() => {});

  const users = await store.getUsersByIds([
    ...new Set(messages.flatMap(m => [m.from_user_id, m.to_user_id])),
  ]);
  const userMap = new Map(users.map(u => [u.id, u]));

  res.json({
    messages: messages.map(m => {
      const from = userMap.get(m.from_user_id) || {};
      const to = userMap.get(m.to_user_id) || {};
      return {
        ...normalizeMessage(m),
        from_nickname: from.nickname || '已注销用户',
        from_avatar: from.avatar || defaultAvatar('?'),
        to_nickname: to.nickname || '已注销用户',
        to_avatar: to.avatar || defaultAvatar('?'),
      };
    }),
  });
}));

app.post('/api/message', rateLimit(200, 10 * 60 * 1000), ah(async (req, res) => {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  const toUserId = clean(req.body.toUserId, 60);
  const content = clean(req.body.content, 2000);
  if (!content) return res.status(400).json({ error: '消息内容不能为空' });
  if (!toUserId) return res.status(400).json({ error: '收件人不存在' });
  if (toUserId === user.id) return res.status(400).json({ error: '不能给自己发私信' });

  const target = await store.getUserById(toUserId);
  if (!target) return res.status(404).json({ error: '收件人不存在' });

  const message = {
    id: newId(),
    from_user_id: user.id,
    to_user_id: target.id,
    content,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  const saved = await store.createMessage(message);

  res.json({ message: normalizeMessage(saved) });
}));

// ==================== 搜索 ====================
app.get('/api/search', ah(async (req, res) => {
  const q = clean(req.query.q, 50);
  const category = String(req.query.category || 'all');
  const viewer = await authUser(req);
  if (!q) return res.json({ posts: [] });

  const posts = await store.searchPosts({ q, category, limit: 50 });
  const decorated = await decoratePosts(posts, viewer);
  res.json({ posts: decorated });
}));

// ==================== 兜底 ====================
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? '单个文件不能超过 ' + MAX_FILE_MB + 'MB'
        : err.code === 'LIMIT_FILE_COUNT'
        ? '一次最多上传 ' + MAX_FILES + ' 个文件'
        : '文件上传失败：' + err.message;
    return res.status(400).json({ error: message });
  }
  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({ error: '服务器出错了，请稍后重试' });
});

// ==================== 启动钩子 ====================
// 本地监听（server.js）和 Serverless 函数（netlify/functions/api.js）共用。
let started = false;

function startup() {
  if (started) return;
  started = true;
  ensureWelcomePost().catch(() => {});
  const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString();
  store.deleteSessionsBefore(cutoff).catch(() => {});
}

module.exports = { app, startup, MAX_FILE_MB };

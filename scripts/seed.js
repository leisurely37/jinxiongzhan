#!/usr/bin/env node
// 把本地 data/data.json 里的旧数据（用户、帖子、评论、点赞、私信）迁移到 Supabase。
// 用法：npm run seed
require('../lib/env')();

const fs = require('fs');
const path = require('path');

const config = require('../lib/config');

if (!config.useSupabase) {
  console.error('❌ 未检测到 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。');
  console.error('   请先在 .env 里填好这两项，或在命令行里临时设置环境变量。');
  process.exit(1);
}

const store = require('../lib/store-supabase');
const { hashPassword } = require('../lib/auth');
const { mimeOf } = require('../lib/storage');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'data.json');

const cache = new Map();

async function upsert(table, rows, conflict = 'id') {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    await store._request(table, {
      method: 'POST',
      query: { on_conflict: conflict },
      body: batch,
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }
}

// 旧数据里的 /uploads/xxx 是本地相对路径，迁移时把文件搬到 Supabase Storage
async function rehost(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.startsWith('/uploads/')) return url;
  if (cache.has(url)) return cache.get(url);

  const relative = decodeURIComponent(url.replace(/^\/+/, ''));
  const filePath = path.join(PUBLIC_DIR, relative);
  if (!fs.existsSync(filePath)) return url;

  const buffer = fs.readFileSync(filePath);
  const objectPath = relative.replace(/^uploads\//, '');
  const publicUrl = await store.uploadFile({
    buffer,
    contentType: mimeOf(filePath),
    objectPath,
  });
  cache.set(url, publicUrl);
  console.log('  ↑ 已上传 ' + objectPath);
  return publicUrl;
}

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('❌ 找不到本地数据文件：' + DATA_FILE);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log('📦 读取到本地数据：');
  console.log('   用户 ' + (data.users || []).length + ' · 帖子 ' + (data.posts || []).length +
    ' · 评论 ' + (data.comments || []).length + ' · 点赞 ' + (data.likes || []).length +
    ' · 私信 ' + (data.messages || []).length);
  console.log('☁️  目标：' + config.supabaseUrl + '\n');

  // 1. 用户
  const users = [];
  for (const u of data.users || []) {
    const password = /^scrypt\$/.test(String(u.password || ''))
      ? u.password
      : hashPassword(u.password || '123456');
    users.push({
      id: u.id,
      nickname: u.nickname,
      password,
      avatar: await rehost(u.avatar),
      bio: u.bio || '',
      created_at: u.created_at || new Date().toISOString(),
    });
  }
  await upsert('users', users);
  console.log('✅ 用户导入完成：' + users.length);

  // 2. 帖子（图片 / 附件也要搬）
  const posts = [];
  for (const p of data.posts || []) {
    const images = [];
    for (const url of p.images || []) images.push(await rehost(url));

    const files = [];
    for (const f of p.files || []) {
      if (typeof f === 'string') {
        files.push({ name: path.basename(f), url: await rehost(f), size: 0 });
      } else {
        files.push({ name: f.name, url: await rehost(f.url), size: f.size || 0 });
      }
    }

    posts.push({
      id: p.id,
      user_id: p.user_id,
      category: p.category || 'life',
      title: p.title,
      content: p.content,
      images,
      files,
      created_at: p.created_at || new Date().toISOString(),
    });
  }
  await upsert('posts', posts);
  console.log('✅ 帖子导入完成：' + posts.length);

  // 3. 评论
  const comments = (data.comments || []).map(c => ({
    id: c.id,
    post_id: c.post_id,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at || new Date().toISOString(),
  }));
  await upsert('comments', comments);
  console.log('✅ 评论导入完成：' + comments.length);

  // 4. 点赞
  const likes = (data.likes || []).map(l => ({
    id: l.id,
    user_id: l.user_id,
    post_id: l.post_id,
    created_at: l.created_at || new Date().toISOString(),
  }));
  await upsert('likes', likes);
  console.log('✅ 点赞导入完成：' + likes.length);

  // 5. 私信
  const messages = (data.messages || []).map(m => ({
    id: m.id,
    from_user_id: m.from_user_id,
    to_user_id: m.to_user_id,
    content: m.content,
    is_read: Boolean(m.is_read || m.read),
    created_at: m.created_at || new Date().toISOString(),
  }));
  await upsert('messages', messages);
  console.log('✅ 私信导入完成：' + messages.length);

  console.log('\n🎉 迁移完成！旧的登录状态不会被迁移，用户重新登录一次即可。');
}

main().catch(err => {
  console.error('\n❌ 迁移失败：' + err.message);
  process.exit(1);
});

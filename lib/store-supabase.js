// Supabase 存储后端：直接走 PostgREST / Storage 的 HTTP 接口，不引入额外 npm 依赖。
// 服务端使用 service_role key，可绕过 RLS；前端永远不会拿到这个 key。
const { supabaseUrl, supabaseKey, bucket } = require('./config');

const REST = supabaseUrl + '/rest/v1';
const STORAGE = supabaseUrl + '/storage/v1';

// 密钥有两种形态：
//  - 旧版 service_role：JWT（eyJ 开头），放在 Authorization: Bearer 里由 PostgREST 解析角色
//  - 新版 secret key：sb_secret_ 开头，不是 JWT，只能放在 apikey 头里，放 Bearer 会 401
function authHeaders(base) {
  const headers = Object.assign({}, base);
  if (supabaseKey.startsWith('eyJ')) {
    headers.Authorization = 'Bearer ' + supabaseKey;
  }
  return headers;
}

function headers(extra) {
  return authHeaders(
    Object.assign(
      {
        apikey: supabaseKey,
        'Content-Type': 'application/json',
      },
      extra || {}
    )
  );
}

function qs(params) {
  const parts = [];
  Object.keys(params || {}).forEach(key => {
    const value = params[key];
    if (value === undefined || value === null || value === '') return;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  });
  return parts.join('&');
}

function parseCount(header) {
  if (!header) return null;
  const m = /\/\s*(\d+|\*)\s*$/.exec(header);
  if (!m || m[1] === '*') return null;
  return Number(m[1]);
}

async function request(table, { method = 'GET', query, body, prefer, head = false } = {}) {
  const url = REST + '/' + table + (query ? '?' + qs(query) : '');
  const init = {
    method,
    headers: headers(prefer ? { Prefer: prefer } : undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new Error('无法连接 Supabase：' + e.message);
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
  }
  if (!res.ok) {
    const detail = data && typeof data === 'object' ? data.message || JSON.stringify(data) : String(data || '');
    throw new Error(`Supabase ${table} 请求失败 (${res.status})：${detail}`);
  }
  return { data, headers: res.headers };
}

function quotedList(values) {
  return '(' + values.map(v => '"' + String(v).replace(/"/g, '') + '"').join(',') + ')';
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const store = {
  mode: 'supabase',
  backend: 'supabase-postgres',

  async getUserById(id) {
    const { data } = await request('users', { query: { id: 'eq.' + id, select: '*', limit: 1 } });
    return (data && data[0]) || null;
  },

  async getUserByNickname(nickname) {
    const { data } = await request('users', {
      query: { nickname: 'eq.' + nickname, select: '*', limit: 1 },
    });
    return (data && data[0]) || null;
  },

  async getUsersByIds(ids) {
    if (!ids.length) return [];
    const out = [];
    for (const part of chunk(ids, 100)) {
      const { data } = await request('users', {
        query: { id: 'in.' + quotedList(part), select: 'id,nickname,avatar' },
      });
      if (data) out.push(...data);
    }
    return out;
  },

  async createUser(user) {
    const { data } = await request('users', {
      method: 'POST',
      body: user,
      prefer: 'return=representation',
    });
    return (data && data[0]) || user;
  },

  async updateUser(id, patch) {
    const { data } = await request('users', {
      method: 'PATCH',
      query: { id: 'eq.' + id },
      body: patch,
      prefer: 'return=representation',
    });
    return (data && data[0]) || null;
  },

  async countUsers() {
    const { headers } = await request('users', {
      query: { select: 'id', limit: 1 },
      prefer: 'count=exact',
    });
    const count = parseCount(headers.get('content-range'));
    return count === null ? 0 : count;
  },

  async listPosts({ category = 'all', offset = 0, limit = 20 } = {}) {
    const query = {
      select: '*',
      order: 'created_at.desc',
      limit,
      offset,
    };
    if (category && category !== 'all') query.category = 'eq.' + category;
    const { data, headers } = await request('posts', { query, prefer: 'count=exact' });
    const count = parseCount(headers.get('content-range'));
    return { posts: data || [], total: count === null ? (data || []).length : count };
  },

  async getPost(id) {
    const { data } = await request('posts', { query: { id: 'eq.' + id, select: '*', limit: 1 } });
    return (data && data[0]) || null;
  },

  async createPost(post) {
    const { data } = await request('posts', {
      method: 'POST',
      body: post,
      prefer: 'return=representation',
    });
    return (data && data[0]) || post;
  },

  async deletePost(id) {
    await request('posts', { method: 'DELETE', query: { id: 'eq.' + id } });
  },

  async listPostsByUser(userId) {
    const { data } = await request('posts', {
      query: { user_id: 'eq.' + userId, select: '*', order: 'created_at.desc' },
    });
    return data || [];
  },

  async countPostsByUser(userId) {
    const { headers } = await request('posts', {
      query: { user_id: 'eq.' + userId, select: 'id', limit: 1 },
      prefer: 'count=exact',
    });
    const count = parseCount(headers.get('content-range'));
    return count === null ? 0 : count;
  },

  async searchPosts({ q, category = 'all', limit = 50 } = {}) {
    const safe = String(q || '').replace(/[,()*%"\\]/g, ' ').trim();
    if (!safe) return [];
    const query = {
      select: '*',
      or: `(title.ilike.*${safe}*,content.ilike.*${safe}*)`,
      order: 'created_at.desc',
      limit,
    };
    if (category && category !== 'all') query.category = 'eq.' + category;
    const { data } = await request('posts', { query });
    return data || [];
  },

  async addLike(like) {
    const { data } = await request('likes', {
      method: 'POST',
      body: like,
      query: { on_conflict: 'user_id,post_id' },
      prefer: 'resolution=ignore-duplicates,return=representation',
    });
    return (data && data[0]) || like;
  },

  async removeLike(postId, userId) {
    await request('likes', {
      method: 'DELETE',
      query: { post_id: 'eq.' + postId, user_id: 'eq.' + userId },
    });
  },

  async isLiked(postId, userId) {
    const { data } = await request('likes', {
      query: { post_id: 'eq.' + postId, user_id: 'eq.' + userId, select: 'id', limit: 1 },
    });
    return Boolean(data && data.length);
  },

  async countLikesByPost(postIds) {
    const map = new Map();
    if (!postIds.length) return map;
    for (const part of chunk(postIds, 100)) {
      const { data } = await request('likes', {
        query: { post_id: 'in.' + quotedList(part), select: 'post_id' },
      });
      (data || []).forEach(row => {
        map.set(row.post_id, (map.get(row.post_id) || 0) + 1);
      });
    }
    return map;
  },

  async getLikedPostIds(userId, postIds) {
    const set = new Set();
    if (!postIds.length) return set;
    for (const part of chunk(postIds, 100)) {
      const { data } = await request('likes', {
        query: {
          user_id: 'eq.' + userId,
          post_id: 'in.' + quotedList(part),
          select: 'post_id',
        },
      });
      (data || []).forEach(row => set.add(row.post_id));
    }
    return set;
  },

  async countLikesForUserPosts(userId) {
    const { data: posts } = await request('posts', {
      query: { user_id: 'eq.' + userId, select: 'id' },
    });
    const ids = (posts || []).map(p => p.id);
    if (!ids.length) return 0;
    let total = 0;
    for (const part of chunk(ids, 100)) {
      const { data } = await request('likes', {
        query: { post_id: 'in.' + quotedList(part), select: 'id' },
      });
      total += (data || []).length;
    }
    return total;
  },

  async listComments(postId) {
    const { data } = await request('comments', {
      query: { post_id: 'eq.' + postId, select: '*', order: 'created_at.asc' },
    });
    return data || [];
  },

  async getComment(id) {
    const { data } = await request('comments', {
      query: { id: 'eq.' + id, select: '*', limit: 1 },
    });
    return (data && data[0]) || null;
  },

  async createComment(comment) {
    const { data } = await request('comments', {
      method: 'POST',
      body: comment,
      prefer: 'return=representation',
    });
    return (data && data[0]) || comment;
  },

  async deleteComment(id) {
    await request('comments', { method: 'DELETE', query: { id: 'eq.' + id } });
  },

  async countCommentsByPost(postIds) {
    const map = new Map();
    if (!postIds.length) return map;
    for (const part of chunk(postIds, 100)) {
      const { data } = await request('comments', {
        query: { post_id: 'in.' + quotedList(part), select: 'post_id' },
      });
      (data || []).forEach(row => {
        map.set(row.post_id, (map.get(row.post_id) || 0) + 1);
      });
    }
    return map;
  },

  async listMessagesForUser(userId) {
    const { data } = await request('messages', {
      query: {
        or: `(from_user_id.eq.${userId},to_user_id.eq.${userId})`,
        select: '*',
        order: 'created_at.desc',
        limit: 1000,
      },
    });
    return data || [];
  },

  async listConversation(a, b) {
    const { data } = await request('messages', {
      query: {
        or: `(and(from_user_id.eq.${a},to_user_id.eq.${b}),and(from_user_id.eq.${b},to_user_id.eq.${a}))`,
        select: '*',
        order: 'created_at.asc',
        limit: 500,
      },
    });
    return data || [];
  },

  async createMessage(message) {
    const { data } = await request('messages', {
      method: 'POST',
      body: message,
      prefer: 'return=representation',
    });
    return (data && data[0]) || message;
  },

  async markConversationRead(fromId, toId) {
    await request('messages', {
      method: 'PATCH',
      query: { from_user_id: 'eq.' + fromId, to_user_id: 'eq.' + toId, is_read: 'eq.false' },
      body: { is_read: true },
      prefer: 'return=minimal',
    });
  },

  async unreadCount(userId) {
    const { headers } = await request('messages', {
      query: { to_user_id: 'eq.' + userId, is_read: 'eq.false', select: 'id', limit: 1 },
      prefer: 'count=exact',
    });
    const count = parseCount(headers.get('content-range'));
    return count === null ? 0 : count;
  },

  async createSession(session) {
    const { data } = await request('sessions', {
      method: 'POST',
      body: session,
      prefer: 'return=representation',
    });
    return (data && data[0]) || session;
  },

  async getSession(token) {
    const { data } = await request('sessions', {
      query: { token: 'eq.' + token, select: '*', limit: 1 },
    });
    return (data && data[0]) || null;
  },

  async deleteSession(token) {
    await request('sessions', { method: 'DELETE', query: { token: 'eq.' + token } });
  },

  async deleteSessionsBefore(iso) {
    await request('sessions', {
      method: 'DELETE',
      query: { created_at: 'lt.' + iso },
      prefer: 'return=minimal',
    });
  },

  // 健康检查用
  async ping() {
    const { headers } = await request('users', {
      query: { select: 'id', limit: 1 },
      prefer: 'count=exact',
    });
    return parseCount(headers.get('content-range')) !== null;
  },
};

// ---------------- 文件存储 ----------------
async function uploadFile({ buffer, contentType, objectPath }) {
  const url = `${STORAGE}/object/${encodeURIComponent(bucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: authHeaders({
        apikey: supabaseKey,
        'Content-Type': contentType || 'application/octet-stream',
        'x-upsert': 'true',
        'cache-control': 'public, max-age=31536000, immutable',
      }),
      body: buffer,
    });
  } catch (e) {
    throw new Error('文件上传失败：' + e.message);
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error('文件上传失败 (' + res.status + ')：' + detail.slice(0, 200));
  }
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

store.uploadFile = uploadFile;
store.bucket = bucket;
store._request = request; // 供 scripts/seed.js 迁移数据使用

module.exports = store;

// 本地 JSON 存储（仅本地预览 / 未配置 Supabase 时使用）。
// 线上 Render 免费实例磁盘是临时的，所以线上必须走 Supabase（见 store-supabase.js）。
const fs = require('fs');
const path = require('path');
const { defaultAvatar } = require('./avatar');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = process.env.DATA_FILE || path.join(DATA_DIR, 'data.json');

function emptyDb() {
  return { users: [], posts: [], likes: [], comments: [], messages: [], sessions: [] };
}

let db = emptyDb();

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      db = Object.assign(emptyDb(), parsed);
      ['users', 'posts', 'likes', 'comments', 'messages', 'sessions'].forEach(k => {
        if (!Array.isArray(db[k])) db[k] = [];
      });
    } else {
      seed();
      save();
    }
  } catch (e) {
    console.error('[local] 数据读取失败，使用空数据：', e.message);
    db = emptyDb();
  }
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.error('[local] 数据保存失败：', e.message);
  }
}

function seed() {
  const now = new Date().toISOString();
  db.users = [
    { id: 'u1', nickname: '星河漫步', password: '123456', avatar: defaultAvatar('星河漫步'), bio: '热爱生活的摄影人', created_at: now },
    { id: 'u2', nickname: '猫咪研究员', password: '123456', avatar: defaultAvatar('猫咪研究员'), bio: '猫奴一枚', created_at: now },
    { id: 'u3', nickname: '学术小透明', password: '123456', avatar: defaultAvatar('学术小透明'), bio: '在读研究生', created_at: now },
  ];
  db.posts = [
    { id: 'p1', user_id: 'u1', category: 'art', title: '周末写生：秋日的城市公园', content: '今天天气特别好，带着画本去公园画了一下午。秋天的颜色真的太美了，金黄的银杏、火红的枫叶，还有偶尔飘过的梧桐叶。大家最近都在哪里写生呀？', images: [], files: [], created_at: now },
    { id: 'p2', user_id: 'u2', category: 'life', title: '我家猫主子的日常', content: '分享一下我家橘猫的日常，每天除了吃就是睡，偶尔拆个家。大家的猫咪也都是这样吗？', images: [], files: [], created_at: now },
    { id: 'p3', user_id: 'u3', category: 'academic', title: '论文写作：文献综述怎么写？', content: '最近在写文献综述，感觉好难下手。有没有学长学姐分享一下经验？如何找到研究空白？如何组织文章结构？', images: [], files: [], created_at: now },
    { id: 'p4', user_id: 'u1', category: 'entertainment', title: '推荐一部最近看的好电影', content: '最近看了一部治愈系电影，看完心里暖暖的。画面超美，配乐也很赞。具体名字就不剧透了，大家有什么好看的电影推荐吗？', images: [], files: [], created_at: now },
  ];
  db.comments = [
    { id: 'c1', post_id: 'p1', user_id: 'u2', content: '好羡慕！我也想去写生，但是手残党表示只会画火柴人😂', created_at: now },
    { id: 'c2', post_id: 'p1', user_id: 'u3', content: '秋天真的是最适合画画的季节！', created_at: now },
    { id: 'c3', post_id: 'p2', user_id: 'u1', content: '橘猫都是这样的，我家那只也是！', created_at: now },
  ];
  db.likes = [
    { id: 'l1', user_id: 'u2', post_id: 'p1', created_at: now },
    { id: 'l2', user_id: 'u3', post_id: 'p1', created_at: now },
    { id: 'l3', user_id: 'u1', post_id: 'p2', created_at: now },
  ];
}

load();

function lower(s) {
  return String(s || '').toLowerCase();
}

function byNewest(a, b) {
  return new Date(b.created_at) - new Date(a.created_at);
}

function countMap(list, key) {
  const map = new Map();
  list.forEach(item => {
    const k = item[key];
    map.set(k, (map.get(k) || 0) + 1);
  });
  return map;
}

const store = {
  mode: 'local',
  backend: 'local-json',

  async getUserById(id) {
    return db.users.find(u => u.id === id) || null;
  },

  async getUserByNickname(nickname) {
    return db.users.find(u => u.nickname === nickname) || null;
  },

  async getUsersByIds(ids) {
    const set = new Set(ids);
    return db.users.filter(u => set.has(u.id));
  },

  async createUser(user) {
    const record = {
      bio: '',
      avatar: defaultAvatar(user.nickname),
      created_at: new Date().toISOString(),
      ...user,
    };
    db.users.push(record);
    save();
    return record;
  },

  async updateUser(id, patch) {
    const user = db.users.find(u => u.id === id);
    if (!user) return null;
    Object.assign(user, patch);
    save();
    return user;
  },

  async countUsers() {
    return db.users.length;
  },

  async listPosts({ category = 'all', offset = 0, limit = 20 } = {}) {
    let list = db.posts.slice();
    if (category && category !== 'all') list = list.filter(p => p.category === category);
    list.sort(byNewest);
    return { posts: list.slice(offset, offset + limit), total: list.length };
  },

  async getPost(id) {
    return db.posts.find(p => p.id === id) || null;
  },

  async createPost(post) {
    const record = { images: [], files: [], created_at: new Date().toISOString(), ...post };
    db.posts.push(record);
    save();
    return record;
  },

  async deletePost(id) {
    db.posts = db.posts.filter(p => p.id !== id);
    db.likes = db.likes.filter(l => l.post_id !== id);
    db.comments = db.comments.filter(c => c.post_id !== id);
    save();
  },

  async listPostsByUser(userId) {
    return db.posts.filter(p => p.user_id === userId).sort(byNewest);
  },

  async countPostsByUser(userId) {
    return db.posts.filter(p => p.user_id === userId).length;
  },

  async searchPosts({ q, category = 'all', limit = 50 } = {}) {
    const needle = lower(q);
    let list = db.posts.filter(
      p => lower(p.title).includes(needle) || lower(p.content).includes(needle)
    );
    if (category && category !== 'all') list = list.filter(p => p.category === category);
    return list.sort(byNewest).slice(0, limit);
  },

  async addLike(like) {
    const exists = db.likes.find(l => l.post_id === like.post_id && l.user_id === like.user_id);
    if (exists) return exists;
    db.likes.push(like);
    save();
    return like;
  },

  async removeLike(postId, userId) {
    const before = db.likes.length;
    db.likes = db.likes.filter(l => !(l.post_id === postId && l.user_id === userId));
    if (db.likes.length !== before) save();
  },

  async isLiked(postId, userId) {
    return db.likes.some(l => l.post_id === postId && l.user_id === userId);
  },

  async countLikesByPost(postIds) {
    const set = new Set(postIds);
    return countMap(db.likes.filter(l => set.has(l.post_id)), 'post_id');
  },

  async getLikedPostIds(userId, postIds) {
    const set = new Set(postIds);
    return new Set(
      db.likes.filter(l => l.user_id === userId && set.has(l.post_id)).map(l => l.post_id)
    );
  },

  async countLikesForUserPosts(userId) {
    const ids = new Set(db.posts.filter(p => p.user_id === userId).map(p => p.id));
    return db.likes.filter(l => ids.has(l.post_id)).length;
  },

  async listComments(postId) {
    return db.comments
      .filter(c => c.post_id === postId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  },

  async getComment(id) {
    return db.comments.find(c => c.id === id) || null;
  },

  async createComment(comment) {
    const record = { created_at: new Date().toISOString(), ...comment };
    db.comments.push(record);
    save();
    return record;
  },

  async deleteComment(id) {
    db.comments = db.comments.filter(c => c.id !== id);
    save();
  },

  async countCommentsByPost(postIds) {
    const set = new Set(postIds);
    return countMap(db.comments.filter(c => set.has(c.post_id)), 'post_id');
  },

  async listMessagesForUser(userId) {
    return db.messages
      .filter(m => m.from_user_id === userId || m.to_user_id === userId)
      .sort(byNewest);
  },

  async listConversation(a, b) {
    return db.messages
      .filter(
        m =>
          (m.from_user_id === a && m.to_user_id === b) ||
          (m.from_user_id === b && m.to_user_id === a)
      )
      .sort((x, y) => new Date(x.created_at) - new Date(y.created_at));
  },

  async createMessage(message) {
    const record = { is_read: false, created_at: new Date().toISOString(), ...message };
    db.messages.push(record);
    save();
    return record;
  },

  async markConversationRead(fromId, toId) {
    let changed = false;
    db.messages.forEach(m => {
      if (m.from_user_id === fromId && m.to_user_id === toId && !m.is_read) {
        m.is_read = true;
        changed = true;
      }
    });
    if (changed) save();
  },

  async unreadCount(userId) {
    return db.messages.filter(m => m.to_user_id === userId && !m.is_read).length;
  },

  async createSession(session) {
    const record = { created_at: new Date().toISOString(), ...session };
    db.sessions.push(record);
    save();
    return record;
  },

  async getSession(token) {
    return db.sessions.find(s => s.token === token) || null;
  },

  async deleteSession(token) {
    db.sessions = db.sessions.filter(s => s.token !== token);
    save();
  },

  async deleteSessionsBefore(iso) {
    db.sessions = db.sessions.filter(s => !s.created_at || s.created_at >= iso);
    save();
  },

  // 供迁移脚本使用
  _raw: () => db,
  _save: save,
};

module.exports = store;

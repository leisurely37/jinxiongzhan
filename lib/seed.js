// 首次部署到空数据库时，自动创建官方账号和一条欢迎帖，避免站点打开是空白的。
const crypto = require('crypto');
const store = require('./store');
const { hashPassword, newId } = require('./auth');
const { defaultAvatar } = require('./avatar');

const WELCOME_TITLE = '欢迎加入金熊站 🐻';
const WELCOME_CONTENT = [
  '欢迎来到金熊站，一个属于大家的兴趣社区！',
  '',
  '这里有四个分区，随便逛：',
  '🎨 艺术：绘画、摄影、音乐、手作……',
  '🌿 生活：日常记录、美食、旅行、宠物……',
  '📚 学术：课程、论文、考研、读书笔记……',
  '🎮 娱乐：电影、游戏、动漫、追番……',
  '',
  '注册后即可发帖、评论、点赞，也可以私信认识新朋友。',
  '友善发言，一起把这里变成热闹的小社区吧～',
].join('\n');

async function ensureWelcomePost() {
  try {
    const userCount = await store.countUsers();
    if (userCount > 0) return false;

    const now = new Date().toISOString();
    const official = {
      id: newId(),
      nickname: '金熊站',
      password: hashPassword(crypto.randomBytes(18).toString('hex')),
      avatar: defaultAvatar('金熊站'),
      bio: '金熊站官方账号',
      created_at: now,
    };
    await store.createUser(official);

    await store.createPost({
      id: newId(),
      user_id: official.id,
      category: 'life',
      title: WELCOME_TITLE,
      content: WELCOME_CONTENT,
      images: [],
      files: [],
      created_at: now,
    });
    console.log('[seed] 已创建官方账号和欢迎帖');
    return true;
  } catch (e) {
    console.error('[seed] 初始化欢迎帖失败（不影响启动）：', e.message);
    return false;
  }
}

module.exports = { ensureWelcomePost };

const config = require('./config');

// 唯一的数据访问入口：线上（配置了 Supabase）用云数据库，本地预览用 JSON 文件。
const store = config.useSupabase ? require('./store-supabase') : require('./store-local');

if (config.useSupabase) {
  console.log('[store] 使用 Supabase 云端数据库：' + config.supabaseUrl);
} else {
  console.log('[store] 未配置 SUPABASE_URL，使用本地 data/data.json（仅适合本地预览）');
}

module.exports = store;

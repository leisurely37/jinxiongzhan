// 运行模式判断：配置了 Supabase 就用云端持久存储，否则退回本地 JSON + 本地磁盘（方便本地预览）。
const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim();
const bucket = (process.env.SUPABASE_BUCKET || 'uploads').trim();

const useSupabase = Boolean(supabaseUrl && supabaseKey);

module.exports = {
  useSupabase,
  supabaseUrl,
  supabaseKey,
  bucket,
  storageMode: useSupabase ? 'supabase' : 'local',
};

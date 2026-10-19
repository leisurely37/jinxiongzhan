// 本地 / 传统服务器启动入口（Render、VPS、本机 npm start 都走这里）
// 纯 Serverless 部署（Netlify）走 netlify/functions/api.js，不经过本文件。
require('./lib/env')();

const config = require('./lib/config');
const { app, startup } = require('./app');

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log('🐻 金熊站社区已启动！');
  console.log('📍 端口: ' + PORT);
  console.log('💾 存储模式: ' + (config.useSupabase ? 'Supabase 云端（数据持久）' : '本地 JSON（会随实例重启丢失）'));
  if (config.useSupabase) console.log('📦 文件存储: Supabase Storage / ' + config.bucket);
  startup();
});

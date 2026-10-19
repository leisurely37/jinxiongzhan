// Netlify Function 入口：把 Express 应用包装成 Serverless 处理器。
// 所有 /api/* 请求由 netlify.toml 里的 redirect 转发到这里。
const serverless = require('serverless-http');
const { app, startup } = require('../../app');

// 冷启动时执行一次（创建欢迎帖、清理过期会话）
startup();

const inner = serverless(app);

exports.handler = async (event, context) => {
  // 不同部署形态下，函数收到的路径可能是 /api/xxx，
  // 也可能是 /.netlify/functions/api/xxx，这里统一还原成 /api/xxx
  const original = event.path || event.rawPath || '';
  const prefix = '/.netlify/functions/api';
  if (original.startsWith(prefix)) {
    const fixed = '/api' + original.slice(prefix.length);
    event.path = fixed;
    if (event.rawPath) event.rawPath = fixed;
  }
  return inner(event, context);
};

#!/usr/bin/env node
// 上线前自检：检查环境变量、数据库连通性、文件桶是否可用。
// 用法：npm run preflight
require('../lib/env')();

const config = require('../lib/config');

async function main() {
  console.log('🔍 金熊站上线自检\n');

  if (!config.useSupabase) {
    console.log('⚠️  未配置 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。');
    console.log('   当前会使用本地 data/data.json（Render 免费实例重启后会丢失数据）。');
    console.log('   线上部署请务必配置 Supabase，见 DEPLOY.md。\n');
  } else {
    console.log('✅ SUPABASE_URL = ' + config.supabaseUrl);
    console.log('✅ SERVICE_ROLE_KEY 已填写（长度 ' + config.supabaseKey.length + '）');

    const store = require('../lib/store-supabase');

    try {
      const ok = await store.ping();
      console.log(ok ? '✅ 数据库连接正常（rest/v1 可访问）' : '⚠️  数据库可访问，但未返回计数');
    } catch (e) {
      console.log('❌ 数据库连接失败：' + e.message);
      console.log('   请确认已执行 supabase/schema.sql，且 URL / KEY 没有多余空格。');
    }

    try {
      const keyHeaders = { apikey: config.supabaseKey };
      if (config.supabaseKey.startsWith('eyJ')) {
        keyHeaders.Authorization = 'Bearer ' + config.supabaseKey;
      }
      const res = await fetch(
        config.supabaseUrl + '/storage/v1/bucket/' + encodeURIComponent(config.bucket),
        { headers: keyHeaders }
      );
      if (res.ok) {
        const info = await res.json();
        console.log('✅ 文件桶 "' + config.bucket + '" 存在，public=' + info.public);
        if (!info.public) console.log('⚠️  该桶不是 public，帖子图片/头像将无法显示。');
      } else {
        console.log('❌ 文件桶 "' + config.bucket + '" 不存在或无权访问（HTTP ' + res.status + '）');
        console.log('   请执行 supabase/schema.sql，或到 Storage 页面手动创建 public 桶。');
      }
    } catch (e) {
      console.log('❌ 文件桶检查失败：' + e.message);
    }
  }

  console.log('\n📋 下一步：npm start 本地预览；部署步骤见 DEPLOY.md');
}

main();

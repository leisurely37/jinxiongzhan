// 极简 .env 加载器：本地开发读取项目根目录的 .env，线上直接用平台注入的环境变量。
const fs = require('fs');
const path = require('path');

module.exports = function loadEnv(file) {
  const target = file || path.join(__dirname, '..', '.env');
  if (!fs.existsSync(target)) return;
  let text;
  try {
    text = fs.readFileSync(target, 'utf8');
  } catch (e) {
    return;
  }
  text.split(/\r?\n/).forEach(line => {
    if (!line || /^\s*#/.test(line)) return;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) return;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  });
};

// 密码哈希与会话令牌（只用 Node 内置 crypto，不引入额外依赖）
const crypto = require('crypto');

const PREFIX = 'scrypt';
const KEYLEN = 64;

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plain), salt, KEYLEN).toString('hex');
  return `${PREFIX}$${salt}$${hash}`;
}

// 返回 { ok, legacy }：legacy=true 表示库里还是旧的明文密码，登录成功后需要自动升级为哈希
function verifyPassword(plain, stored) {
  if (!stored) return { ok: false, legacy: false };
  const text = String(stored);
  if (!text.startsWith(PREFIX + '$')) {
    // 兼容历史明文密码
    const a = Buffer.from(String(plain));
    const b = Buffer.from(text);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { ok, legacy: ok };
  }
  const parts = text.split('$');
  if (parts.length !== 3) return { ok: false, legacy: false };
  const salt = parts[1];
  const expected = Buffer.from(parts[2], 'hex');
  let actual;
  try {
    actual = crypto.scryptSync(String(plain), salt, KEYLEN);
  } catch (e) {
    return { ok: false, legacy: false };
  }
  const ok = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  return { ok, legacy: false };
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function newId() {
  return Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
}

module.exports = { hashPassword, verifyPassword, newToken, newId };

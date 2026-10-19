// 默认头像直接用 SVG data URI 生成，不占存储空间，也不用额外上传。
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFD93D', '#DDA0DD', '#98D8C8', '#F7DC6F'];

function pickColor(name) {
  let hash = 0;
  const text = String(name || '?');
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function defaultAvatar(nickname) {
  const color = pickColor(nickname);
  // 用 Array.from 取第一个「字符」而不是第一个 UTF-16 编码单元，避免 emoji 昵称头像乱码
  const first = Array.from(String(nickname || '?').trim())[0] || '?';
  const initial = first.toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">` +
    `<circle cx="50" cy="50" r="50" fill="${color}"/>` +
    `<text x="50" y="64" font-size="42" fill="#ffffff" text-anchor="middle" ` +
    `font-family="PingFang SC,Microsoft YaHei,Arial,sans-serif" font-weight="700">${escapeXml(initial)}</text>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { defaultAvatar, pickColor };

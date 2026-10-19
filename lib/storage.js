// 文件存储：配置了 Supabase 时存到 Supabase Storage（公网可访问），否则写到本地 public/uploads。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
};

function extOf(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

function mimeOf(name, fallback) {
  return MIME_BY_EXT[extOf(name)] || fallback || 'application/octet-stream';
}

function randomName(originalname) {
  return Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex') + extOf(originalname);
}

async function saveLocal({ buffer, originalname, kind }) {
  const dir = path.join(UPLOAD_DIR, kind);
  fs.mkdirSync(dir, { recursive: true });
  const filename = randomName(originalname);
  fs.writeFileSync(path.join(dir, filename), buffer);
  return '/uploads/' + kind + '/' + filename;
}

async function upload({ buffer, originalname, mimetype, kind }) {
  const contentType = mimeOf(originalname, mimetype);
  if (config.useSupabase) {
    const store = require('./store-supabase');
    const objectPath = kind + '/' + randomName(originalname);
    const url = await store.uploadFile({ buffer, contentType, objectPath });
    return { url, size: buffer.length, name: originalname, contentType };
  }
  const url = await saveLocal({ buffer, originalname, kind });
  return { url, size: buffer.length, name: originalname, contentType };
}

module.exports = { upload, extOf, mimeOf, UPLOAD_DIR, mode: config.useSupabase ? 'supabase' : 'local' };

const fs = require('node:fs/promises');
const path = require('node:path');

const STATIC_ROOT = path.resolve(__dirname, '../../../../frontend/static');

function assertSafeKey(key) {
  const normalized = String(key || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    throw new Error('Invalid storage key');
  }
  return normalized;
}

async function saveBuffer(key, buffer) {
  const safeKey = assertSafeKey(key);
  const absolutePath = path.join(STATIC_ROOT, safeKey);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return `/static/${safeKey}`;
}

function extractKeyFromUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (!raw.includes('://')) {
    if (raw.startsWith('/static/')) {
      return assertSafeKey(raw.replace(/^\/static\/+/, ''));
    }
    if (!raw.startsWith('/') && !raw.includes('..')) {
      return assertSafeKey(raw);
    }
    return null;
  }

  try {
    const url = new URL(raw);
    if (url.pathname.startsWith('/static/')) {
      return assertSafeKey(url.pathname.replace(/^\/static\/+/, ''));
    }
    return null;
  } catch (_err) {
    return null;
  }
}

async function deleteKey(key) {
  const safeKey = assertSafeKey(key);
  const absolutePath = path.join(STATIC_ROOT, safeKey);
  try {
    await fs.unlink(absolutePath);
    return true;
  } catch (err) {
    if (err?.code === 'ENOENT') return false;
    throw err;
  }
}

function contentTypeFromKey(key) {
  const ext = path.extname(String(key || '')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.avif') return 'image/avif';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

async function getObject(key) {
  const safeKey = assertSafeKey(key);
  const absolutePath = path.join(STATIC_ROOT, safeKey);
  const buffer = await fs.readFile(absolutePath);
  return {
    contentType: contentTypeFromKey(safeKey),
    contentLength: buffer.length,
    buffer,
  };
}

async function walkFiles(root, base, out) {
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }

  for (const entry of entries) {
    const abs = path.join(root, entry.name);
    const rel = path.join(base, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      await walkFiles(abs, rel, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const stats = await fs.stat(abs);
    out.push({
      key: rel,
      size: stats.size,
      lastModified: stats.mtime,
    });
  }
}

async function list(prefix = '') {
  const safePrefix = String(prefix || '').replaceAll('\\', '/').replace(/^\/+/, '');
  const startDir = path.join(STATIC_ROOT, safePrefix);
  const items = [];
  await walkFiles(startDir, safePrefix, items);
  return items;
}

module.exports = { saveBuffer, extractKeyFromUrl, deleteKey, list, getObject };

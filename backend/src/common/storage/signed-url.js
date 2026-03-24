const crypto = require('node:crypto');
const { env } = require('../../config/env');

function toBase64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64Url(input) {
  return Buffer.from(String(input || ''), 'base64url').toString('utf8');
}

function getSecret() {
  return String(env.mediaSignedUrlSecret || '').trim();
}

function isEnabled() {
  return env.mediaSignedUrlEnabled && Boolean(getSecret());
}

function sign(raw) {
  return crypto.createHmac('sha256', getSecret()).update(raw).digest('hex');
}

function buildToken(payload) {
  const body = toBase64Url(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

function createMediaToken(key, expiresInSeconds = env.mediaSignedUrlTtlSeconds) {
  const normalizedKey = String(key || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalizedKey || normalizedKey.includes('..')) return null;
  if (!isEnabled()) return null;

  const ttl = Math.max(30, Number(expiresInSeconds || env.mediaSignedUrlTtlSeconds || 900));
  const payload = {
    k: normalizedKey,
    e: Date.now() + ttl * 1000,
  };
  return buildToken(payload);
}

function verifyMediaToken(token) {
  const raw = String(token || '').trim();
  if (!raw || !isEnabled()) return null;

  const [body, signature] = raw.split('.');
  if (!body || !signature) return null;

  const expected = sign(body);
  const provided = String(signature);
  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) return null;

  let payload = null;
  try {
    payload = JSON.parse(fromBase64Url(body));
  } catch (_err) {
    return null;
  }

  if (!payload || typeof payload !== 'object') return null;
  if (!payload.k || !payload.e) return null;
  if (Date.now() > Number(payload.e)) return null;

  const key = String(payload.k || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!key || key.includes('..')) return null;
  return {
    key,
    expiresAt: new Date(Number(payload.e)),
  };
}

function buildSignedMediaUrl(token) {
  if (!token) return null;
  const routePath = `/api/media/private/${encodeURIComponent(token)}`;
  const base = String(env.mediaSignedUrlBase || '').trim();
  if (!base) return routePath;
  return `${base.replace(/\/+$/, '')}${routePath}`;
}

module.exports = {
  isEnabled,
  createMediaToken,
  verifyMediaToken,
  buildSignedMediaUrl,
};

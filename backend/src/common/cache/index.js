const { env } = require('../../config/env');

const memoryStore = new Map();
let redisClient = null;
let redisReady = false;
let redisConnectStarted = false;

function nowMs() {
  return Date.now();
}

function isRedisEnabled() {
  return Boolean(env.redisUrl || process.env.REDIS_URL);
}

function getRedisModule() {
  try {
    // Optional dependency. System continues with in-memory cache if not installed.
    return require('redis');
  } catch (_err) {
    return null;
  }
}

async function ensureRedisClient() {
  if (!isRedisEnabled()) return null;
  if (redisClient && redisReady) return redisClient;
  if (redisConnectStarted) return redisClient;

  const redis = getRedisModule();
  if (!redis) return null;

  redisConnectStarted = true;
  redisClient = redis.createClient({ url: env.redisUrl || process.env.REDIS_URL });
  redisClient.on('error', () => {
    redisReady = false;
  });
  redisClient.on('ready', () => {
    redisReady = true;
  });

  try {
    await redisClient.connect();
    redisReady = true;
  } catch (_err) {
    redisReady = false;
  }

  return redisClient;
}

function memoryGet(key) {
  const hit = memoryStore.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= nowMs()) {
    memoryStore.delete(key);
    return null;
  }
  return hit.value;
}

function memorySet(key, value, ttlSeconds) {
  const ttlMs = Math.max(1, Number(ttlSeconds || 30)) * 1000;
  memoryStore.set(key, {
    value,
    expiresAt: nowMs() + ttlMs,
  });
}

function memoryDelete(key) {
  memoryStore.delete(key);
}

async function getJson(key) {
  const client = await ensureRedisClient();
  if (client && redisReady) {
    const raw = await client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }
  return memoryGet(key);
}

async function setJson(key, value, ttlSeconds = 30) {
  const client = await ensureRedisClient();
  if (client && redisReady) {
    await client.setEx(key, Math.max(1, Number(ttlSeconds || 30)), JSON.stringify(value));
    return;
  }
  memorySet(key, value, ttlSeconds);
}

async function del(key) {
  const client = await ensureRedisClient();
  if (client && redisReady) {
    await client.del(key);
    return;
  }
  memoryDelete(key);
}

async function delMany(keys = []) {
  const unique = [...new Set(keys.map((x) => String(x || '').trim()).filter(Boolean))];
  if (!unique.length) return;

  const client = await ensureRedisClient();
  if (client && redisReady) {
    await client.del(unique);
    return;
  }

  unique.forEach((key) => memoryDelete(key));
}

module.exports = {
  isRedisEnabled,
  getJson,
  setJson,
  del,
  delMany,
};

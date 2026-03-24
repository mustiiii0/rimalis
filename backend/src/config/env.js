const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const INSECURE_SECRET_VALUES = new Set([
  '',
  'change_me_access_secret',
  'change_me_refresh_secret',
  'dev-access-secret',
  'dev-refresh-secret',
  'secret',
  'changeme',
  'password',
  'test-secret',
]);

function parseCorsOrigins(raw) {
  return (raw || 'http://localhost:8000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isWeakSecret(value) {
  const secret = String(value || '').trim();
  if (!secret) return true;
  if (INSECURE_SECRET_VALUES.has(secret)) return true;
  if (/^(.)\1{15,}$/.test(secret)) return true;
  if (secret.length < 32) return true;
  return false;
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch (_err) {
    return false;
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8080),
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/rimalis',
  dbSsl: process.env.DB_SSL === 'true',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  trustProxy: process.env.TRUST_PROXY === 'true',
  securityAlertWebhook: process.env.SECURITY_ALERT_WEBHOOK || '',
  mediaCleanupCronEnabled: process.env.MEDIA_CLEANUP_CRON_ENABLED
    ? process.env.MEDIA_CLEANUP_CRON_ENABLED === 'true'
    : true,
  mediaCleanupCronTime: process.env.MEDIA_CLEANUP_CRON_TIME || '03:20',
  mediaCleanupOlderThanDays: Number(process.env.MEDIA_CLEANUP_OLDER_THAN_DAYS || 30),
  mediaCleanupPrefix: process.env.MEDIA_CLEANUP_PREFIX || 'uploads/images/',
  mediaCleanupMaxDelete: Number(process.env.MEDIA_CLEANUP_MAX_DELETE || 5000),
  mediaCleanupRunOnStart: process.env.MEDIA_CLEANUP_RUN_ON_START === 'true',
  storageDriver: String(process.env.STORAGE_DRIVER || 'local').trim().toLowerCase() || 'local',
  r2Endpoint: process.env.R2_ENDPOINT || '',
  r2Region: process.env.R2_REGION || 'auto',
  r2Bucket: process.env.R2_BUCKET || '',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  mediaSignedUrlSecret: process.env.MEDIA_SIGNED_URL_SECRET || '',
  mediaSignedUrlTtlSeconds: Number(process.env.MEDIA_SIGNED_URL_TTL_SECONDS || 900),
  mediaSignedUrlBase: process.env.MEDIA_SIGNED_URL_BASE || '',
  mediaSignedUrlEnabled: process.env.MEDIA_SIGNED_URL_ENABLED === 'true',
};

if (env.nodeEnv === 'production') {
  if (!env.corsOrigin.length) {
    throw new Error('CORS_ORIGIN must be set in production');
  }

  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT secrets must be set in production');
  }

  if (isWeakSecret(env.jwtAccessSecret) || isWeakSecret(env.jwtRefreshSecret)) {
    throw new Error('JWT secrets must be strong, unique, and at least 32 characters in production');
  }

  if (!env.trustProxy) {
    throw new Error('TRUST_PROXY must be true in production so secure cookies and client IP handling work correctly');
  }

  if (!['local', 'r2'].includes(env.storageDriver)) {
    throw new Error('STORAGE_DRIVER must be either local or r2');
  }

  if (env.storageDriver === 'r2') {
    if (!env.r2Endpoint || !env.r2Bucket || !env.r2AccessKeyId || !env.r2SecretAccessKey) {
      throw new Error('R2 storage requires R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in production');
    }
    if (!isHttpsUrl(env.r2Endpoint)) {
      throw new Error('R2_ENDPOINT must use https in production');
    }
    if (env.r2PublicBaseUrl && !isHttpsUrl(env.r2PublicBaseUrl)) {
      throw new Error('R2_PUBLIC_BASE_URL must use https in production');
    }
  }

  if (env.mediaSignedUrlEnabled) {
    if (isWeakSecret(env.mediaSignedUrlSecret)) {
      throw new Error('MEDIA_SIGNED_URL_SECRET must be strong and at least 32 characters when signed media is enabled in production');
    }
    if (env.mediaSignedUrlBase && !isHttpsUrl(env.mediaSignedUrlBase)) {
      throw new Error('MEDIA_SIGNED_URL_BASE must use https in production');
    }
  }
}

module.exports = { env, isWeakSecret, isHttpsUrl };

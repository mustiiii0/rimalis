let S3Client = null;
let PutObjectCommand = null;
let DeleteObjectCommand = null;
let DeleteObjectsCommand = null;
let ListObjectsV2Command = null;
let GetObjectCommand = null;

function loadSdk() {
  if (S3Client && PutObjectCommand && DeleteObjectCommand && DeleteObjectsCommand && ListObjectsV2Command && GetObjectCommand) return;
  try {
    const sdk = require('@aws-sdk/client-s3');
    S3Client = sdk.S3Client;
    PutObjectCommand = sdk.PutObjectCommand;
    DeleteObjectCommand = sdk.DeleteObjectCommand;
    DeleteObjectsCommand = sdk.DeleteObjectsCommand;
    ListObjectsV2Command = sdk.ListObjectsV2Command;
    GetObjectCommand = sdk.GetObjectCommand;
  } catch (_err) {
    throw new Error('R2 driver requires @aws-sdk/client-s3. Run: npm --prefix backend install @aws-sdk/client-s3');
  }
}

function env(name, fallback = '') {
  return String(process.env[name] || fallback || '').trim();
}

function assertConfig() {
  const endpoint = env('R2_ENDPOINT');
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY');
  const bucket = env('R2_BUCKET');
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('Missing R2 config. Required: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET');
  }
  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    region: env('R2_REGION', 'auto'),
    publicBaseUrl: env('R2_PUBLIC_BASE_URL'),
  };
}

let client = null;
let cached = null;

function getClient() {
  loadSdk();
  if (client && cached) return { client, config: cached };
  const config = assertConfig();
  client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  cached = config;
  return { client, config };
}

function buildPublicUrl(config, key) {
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
  }
  return `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}/${key}`;
}

function assertSafeKey(key) {
  const normalized = String(key || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    throw new Error('Invalid storage key');
  }
  return normalized;
}

function extractKeyFromUrl(input) {
  const { config } = getClient();
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (!raw.includes('://')) {
    if (raw.startsWith('/static/')) return null;
    if (!raw.startsWith('/') && !raw.includes('..')) return assertSafeKey(raw);
    if (raw.startsWith('/')) return assertSafeKey(raw.replace(/^\/+/, ''));
    return null;
  }

  try {
    const url = new URL(raw);
    const endpoint = new URL(config.endpoint);
    const publicBase = config.publicBaseUrl ? config.publicBaseUrl.replace(/\/+$/, '') : '';
    const normalized = raw.replace(/\/+$/, '');

    if (publicBase && normalized.startsWith(publicBase)) {
      const remainder = normalized.slice(publicBase.length).replace(/^\/+/, '');
      return remainder ? assertSafeKey(remainder) : null;
    }

    if (url.host === endpoint.host) {
      const pathname = url.pathname.replace(/^\/+/, '');
      if (pathname.startsWith(`${config.bucket}/`)) {
        return assertSafeKey(pathname.slice(config.bucket.length + 1));
      }
      if (pathname.startsWith('uploads/')) {
        return assertSafeKey(pathname);
      }
    }
    return null;
  } catch (_err) {
    return null;
  }
}

async function saveBuffer(key, buffer, meta = {}) {
  const { client: c, config } = getClient();
  const safeKey = assertSafeKey(key);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: safeKey,
    Body: buffer,
    ContentType: meta.contentType || 'application/octet-stream',
    CacheControl: meta.cacheControl || 'public,max-age=31536000,immutable',
  });
  await c.send(command);
  return buildPublicUrl(config, safeKey);
}

async function deleteKey(key) {
  const { client: c, config } = getClient();
  const safeKey = assertSafeKey(key);
  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: safeKey,
  });
  await c.send(command);
  return true;
}

async function deleteKeys(keys = []) {
  const { client: c, config } = getClient();
  const unique = [...new Set(
    keys
      .map((x) => {
        try {
          return assertSafeKey(x);
        } catch (_err) {
          return null;
        }
      })
      .filter(Boolean)
  )];
  if (!unique.length) return 0;

  const BATCH = 1000;
  let deleted = 0;
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const command = new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: {
        Objects: chunk.map((itemKey) => ({ Key: itemKey })),
        Quiet: true,
      },
    });
    const res = await c.send(command);
    deleted += Array.isArray(res?.Deleted) ? res.Deleted.length : 0;
  }
  return deleted;
}

async function list(prefix = '') {
  const { client: c, config } = getClient();
  const safePrefix = String(prefix || '').replaceAll('\\', '/').replace(/^\/+/, '');
  const out = [];
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: safePrefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });
    const res = await c.send(command);
    const contents = Array.isArray(res?.Contents) ? res.Contents : [];
    for (const item of contents) {
      if (!item?.Key) continue;
      out.push({
        key: item.Key,
        size: Number(item.Size || 0),
        lastModified: item.LastModified ? new Date(item.LastModified) : null,
      });
    }
    continuationToken = res?.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return out;
}

async function getObject(key) {
  const { client: c, config } = getClient();
  const safeKey = assertSafeKey(key);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: safeKey,
  });
  const res = await c.send(command);
  return {
    contentType: String(res?.ContentType || 'application/octet-stream'),
    contentLength: Number(res?.ContentLength || 0) || null,
    bodyStream: res?.Body || null,
  };
}

module.exports = { saveBuffer, extractKeyFromUrl, deleteKey, deleteKeys, list, getObject };

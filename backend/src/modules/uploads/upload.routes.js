const multer = require('multer');
const { Router } = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../../common/middleware/auth');
const { uploadLimiter } = require('../../common/middleware/rate-limit');
const { requireAjaxCsrf } = require('../../common/middleware/csrf');
const { AppError } = require('../../common/errors/app-error');
const storage = require('../../common/storage');

let sharp = null;
try {
  // Optional in dev environments; route falls back to original file if unavailable.
  sharp = require('sharp');
} catch (_err) {
  sharp = null;
}

const router = Router();

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB source upload
const MAX_SOURCE_RESOLUTION_PX = Number(process.env.MAX_SOURCE_RESOLUTION_PX || 2560);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const FILE_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const SV_MONTH_NAMES = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1, fields: 12, parts: 16 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new AppError(400, 'Endast JPG, PNG, WEBP eller GIF tillåts'));
      return;
    }
    cb(null, true);
  },
});

function sanitizeSegment(value, fallback = 'x') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
}

function referenceFromSource(sourceValue) {
  const source = String(sourceValue || '');
  if (!source) return 'RG8-0000';
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return `RG8-${String(hash % 10000).padStart(4, '0')}`;
}

function sanitizeListingRef(value, listingId = '') {
  const cleaned = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (/^RG8-\d{4}$/.test(cleaned)) return cleaned;
  return referenceFromSource(listingId || cleaned || 'listing');
}

function monthSegment(date) {
  const monthIndex = date.getUTCMonth();
  const monthNumber = String(monthIndex + 1).padStart(2, '0');
  const monthName = SV_MONTH_NAMES[monthIndex] || 'manad';
  return `${monthNumber}-${monthName}`;
}

function getUploadMeta(reqBody, bucket) {
  const now = new Date();
  const year = String(now.getUTCFullYear());

  if (bucket === 'listings') {
    const listingIdRaw = String(reqBody?.listingId || '').trim();
    const listingId = sanitizeSegment(listingIdRaw || `annons-${uuid().slice(0, 8)}`, `annons-${uuid().slice(0, 8)}`);
    const listingRef = sanitizeListingRef(reqBody?.listingReference, listingId);
    const imageIndexNum = Number.parseInt(String(reqBody?.imageIndex || '1'), 10);
    const imageIndex = Number.isFinite(imageIndexNum) && imageIndexNum > 0 ? imageIndexNum : 1;

    const listingRefSegment = sanitizeSegment(listingRef, referenceFromSource(listingId).toLowerCase());
    return {
      bucket,
      prefix: `uploads/images/${year}/${monthSegment(now)}/${listingRef}`,
      fileStem: `annons-${listingRefSegment}_bild-${imageIndex}`,
    };
  }

  return {
    bucket,
    prefix: `uploads/avatars/${year}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
    fileStem: `avatar-${sanitizeSegment(reqBody?.avatarId || uuid().slice(0, 12), uuid().slice(0, 12))}`,
  };
}

function bufferLooksLikeImage(buffer, mimeType) {
  if (!buffer || buffer.length < 12) return false;

  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8;
  }

  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  if (mimeType === 'image/webp') {
    const header = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    return header === 'RIFF' && webp === 'WEBP';
  }

  if (mimeType === 'image/gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }

  return false;
}

function variantWidthsByBucket(bucket) {
  if (bucket === 'avatars') return [128, 256, 512];
  return [480, 960, 1600];
}

function variantSizesByBucket(bucket) {
  if (bucket === 'avatars') return '(max-width: 768px) 128px, 256px';
  return '(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1400px';
}

function toSrcSet(variants, format) {
  return variants
    .filter((v) => v.format === format)
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(', ');
}

async function saveVariant(prefix, fileName, buffer, contentType) {
  const key = `${prefix}/${fileName}`;
  const url = await storage.saveBuffer(key, buffer, { contentType });
  return { key, url };
}

async function cleanupPreviousVariants(prefix, fileStem) {
  if (!storage.list || !storage.deleteKeys) return;
  const normalizedPrefix = String(prefix || '').replace(/\/+$/, '');
  const stemPattern = `/${fileStem}`;
  const keys = (await storage.list(`${normalizedPrefix}/`))
    .map((item) => item?.key)
    .filter((key) => typeof key === 'string' && key.includes(stemPattern));
  if (!keys.length) return;
  await storage.deleteKeys(keys);
}

function qualityConfigByFormat(format) {
  if (format === 'avif') return { start: 52, min: 36, step: 6 };
  if (format === 'webp') return { start: 78, min: 56, step: 5 };
  return { start: 80, min: 58, step: 4 };
}

function targetBytesByWidth(width, bucket) {
  if (bucket === 'avatars') {
    if (width <= 128) return 45_000;
    if (width <= 256) return 70_000;
    return 120_000;
  }
  if (width <= 480) return 120_000;
  if (width <= 960) return 220_000;
  return 420_000;
}

async function renderVariantBuffer(buffer, width, format, quality) {
  const transformer = sharp(buffer)
    .rotate()
    .resize({ width, withoutEnlargement: true, fit: 'inside' });

  if (format === 'webp') {
    return transformer.webp({ quality }).toBuffer();
  }
  if (format === 'avif') {
    return transformer.avif({ quality }).toBuffer();
  }
  return transformer.jpeg({ quality, mozjpeg: true }).toBuffer();
}

async function normalizeSourceBuffer(buffer) {
  if (!sharp) return buffer;
  return sharp(buffer)
    .rotate()
    .resize({
      width: MAX_SOURCE_RESOLUTION_PX,
      height: MAX_SOURCE_RESOLUTION_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer();
}

async function renderVariantWithBudget({ buffer, width, format, bucket }) {
  const cfg = qualityConfigByFormat(format);
  const targetBytes = targetBytesByWidth(width, bucket);
  let quality = cfg.start;
  let output = await renderVariantBuffer(buffer, width, format, quality);

  while (output.length > targetBytes && quality > cfg.min) {
    quality = Math.max(cfg.min, quality - cfg.step);
    output = await renderVariantBuffer(buffer, width, format, quality);
  }
  return output;
}

async function buildVariantsWithSharp({ buffer, bucket, prefix, fileStem }) {
  const normalizedBuffer = await normalizeSourceBuffer(buffer);
  const widths = variantWidthsByBucket(bucket);
  const formats = ['avif', 'webp', 'jpeg'];
  const variantPrefix = `${prefix}/_variants`;
  const variants = [];

  for (const width of widths) {
    for (const format of formats) {
      const extension = format === 'jpeg' ? 'jpg' : format;
      const fileName = `${fileStem}_w${width}.${extension}`;
      const output = await renderVariantWithBudget({ buffer: normalizedBuffer, width, format, bucket });
      let contentType = 'image/jpeg';
      if (format === 'webp') contentType = 'image/webp';
      if (format === 'avif') contentType = 'image/avif';

      const stored = await saveVariant(variantPrefix, fileName, output, contentType);
      variants.push({ key: stored.key, url: stored.url, width, format, sizeBytes: output.length });
    }
  }

  const metadata = await sharp(normalizedBuffer).metadata();
  const largestAvif = [...variants].filter((x) => x.format === 'avif').sort((a, b) => b.width - a.width)[0] || null;
  const largestWebp = [...variants].filter((x) => x.format === 'webp').sort((a, b) => b.width - a.width)[0] || null;
  const largestJpeg = [...variants].filter((x) => x.format === 'jpeg').sort((a, b) => b.width - a.width)[0] || null;

  return {
    imageUrl: largestWebp?.url || largestAvif?.url || largestJpeg?.url || null,
    imageKey: largestWebp?.key || largestAvif?.key || largestJpeg?.key || null,
    variants,
    width: metadata.width || null,
    height: metadata.height || null,
    mimeType: 'image/webp',
    srcset: {
      webp: toSrcSet(variants, 'webp'),
      avif: toSrcSet(variants, 'avif'),
      jpeg: toSrcSet(variants, 'jpeg'),
      sizes: variantSizesByBucket(bucket),
    },
  };
}

async function buildFallbackStoredImage({ buffer, mimeType, bucket, prefix, fileStem }) {
  const extension = FILE_EXTENSION_BY_MIME[mimeType] || 'jpg';
  const fileName = `${fileStem}.${extension}`;
  const stored = await saveVariant(prefix, fileName, buffer, mimeType);
  return {
    imageUrl: stored.url,
    imageKey: stored.key,
    variants: [{ key: stored.key, url: stored.url, width: null, format: extension, sizeBytes: buffer.length }],
    width: null,
    height: null,
    mimeType,
    srcset: {
      webp: '',
      avif: '',
      jpeg: stored.url,
      sizes: variantSizesByBucket(bucket),
    },
  };
}

async function storeImage(buffer, mimeType, bucket = 'listings', reqBody = {}) {
  const meta = getUploadMeta(reqBody, bucket);
  await cleanupPreviousVariants(meta.prefix, meta.fileStem);

  // GIF can be animated; skip sharp transcode to avoid killing animation.
  if (!sharp || mimeType === 'image/gif') {
    return buildFallbackStoredImage({ buffer, mimeType, bucket, prefix: meta.prefix, fileStem: meta.fileStem });
  }

  try {
    return await buildVariantsWithSharp({ buffer, bucket, prefix: meta.prefix, fileStem: meta.fileStem });
  } catch (_err) {
    return buildFallbackStoredImage({ buffer, mimeType, bucket, prefix: meta.prefix, fileStem: meta.fileStem });
  }
}

function handleMulterErrors(err, _req, _res, next) {
  if (!(err instanceof multer.MulterError)) {
    next(err);
    return;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    next(new AppError(413, 'Bilden är för stor. Maxstorlek är 15MB.'));
    return;
  }

  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    next(new AppError(400, 'Endast en bildfil kan laddas upp per begäran.'));
    return;
  }

  if (err.code === 'LIMIT_PART_COUNT' || err.code === 'LIMIT_FIELD_COUNT') {
    next(new AppError(400, 'För många formulärfält skickades med uppladdningen.'));
    return;
  }

  next(new AppError(400, 'Ogiltig uppladdningsbegäran.'));
}

async function handleImageUpload(req, res, next, bucket) {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'Ingen bildfil skickades');

    if (!bufferLooksLikeImage(file.buffer, file.mimetype)) {
      throw new AppError(400, 'Ogiltig bildfil');
    }

    const image = await storeImage(file.buffer, file.mimetype, bucket, req.body || {});
    const signedUrl = storage.createSignedMediaUrlFromUrl(image.imageUrl);
    return res.status(201).json({
      success: true,
      imageUrl: image.imageUrl,
      signedUrl: signedUrl || null,
      image,
      storageDriver: storage.getDriverName(),
    });
  } catch (err) {
    return next(err);
  }
}

router.post('/image', requireAuth, requireAjaxCsrf, uploadLimiter, upload.single('image'), handleMulterErrors, async (req, res, next) => {
  return handleImageUpload(req, res, next, 'listings');
});

router.post('/avatar', requireAuth, requireAjaxCsrf, uploadLimiter, upload.single('image'), handleMulterErrors, async (req, res, next) => {
  return handleImageUpload(req, res, next, 'avatars');
});

module.exports = { uploadRoutes: router, handleMulterErrors };

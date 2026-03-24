const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const { sanitizeText } = require('../common/validators/common');
const { requireAjaxCsrf, CSRF_COOKIE_NAME } = require('../common/middleware/csrf');
const { registerSchema } = require('../modules/auth/auth.validator');
const { createMessageSchema, publicMessageReplyQuerySchema } = require('../modules/messages/message.validator');
const { mediaSignLimiter } = require('../common/middleware/rate-limit');
const { handleMulterErrors } = require('../modules/uploads/upload.routes');

function runMiddleware(middleware, req = {}) {
  return new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err || null));
  });
}

function walkFiles(rootDir, allowedExtensions) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, allowedExtensions));
      continue;
    }
    if (allowedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}


test('sanitizeText strips HTML/script tags', () => {
  const input = '<script>alert(1)</script>  Hej <b>Erik</b>';
  const out = sanitizeText(input);
  assert.equal(out, 'alert(1) Hej Erik');
});

test('register schema sanitizes XSS in name', () => {
  const result = registerSchema.safeParse({
    name: '<img src=x onerror=alert(1)> Erik',
    email: 'support@rimalis.se',
    password: 'StrongPass123',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.name.includes('<'), false);
});

test('register schema rejects SQL-like invalid email input', () => {
  const result = registerSchema.safeParse({
    name: 'Erik',
    email: "' OR 1=1 --",
    password: 'StrongPass123',
  });

  assert.equal(result.success, false);
});

test('message schema sanitizes content to reduce stored XSS risk', () => {
  const result = createMessageSchema.safeParse({
    subject: '<b>Visning</b>',
    content: 'Hej <script>alert(1)</script> admin',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.subject, 'Visning');
  assert.equal(result.data.content.includes('<script>'), false);
});

test('csrf middleware blocks requests without X-Requested-With header', async () => {
  const err = await runMiddleware(requireAjaxCsrf, {
    headers: {},
    cookies: {},
    method: 'POST',
    originalUrl: '/api/auth/refresh',
  });
  assert.equal(err.statusCode, 403);
  assert.equal(err.message, 'CSRF validation failed');
});

test('csrf middleware allows matching AJAX CSRF header and cookie', async () => {
  const token = 'test-csrf-token';
  const err = await runMiddleware(requireAjaxCsrf, {
    headers: {
      'x-requested-with': 'XMLHttpRequest',
      'x-csrf-token': token,
    },
    cookies: {
      [CSRF_COOKIE_NAME]: token,
    },
    method: 'POST',
    originalUrl: '/api/auth/refresh',
  });
  assert.equal(err, null);
});

test('production CSP uses nonce-based script policy and injects nonce into HTML scripts', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    TRUST_PROXY: process.env.TRUST_PROXY,
  };

  process.env.NODE_ENV = 'production';
  process.env.JWT_ACCESS_SECRET = 'production-access-secret-1234567890';
  process.env.JWT_REFRESH_SECRET = 'production-refresh-secret-1234567890';
  process.env.CORS_ORIGIN = 'https://rimalis.example';
  process.env.TRUST_PROXY = 'true';

  const modulesToClear = ['../app', '../config/env', '../config/security'];
  for (const id of modulesToClear) {
    delete require.cache[require.resolve(id)];
  }

  try {
    const { createCspDirectives } = require('../config/security');
    const { injectNonceIntoHtml } = require('../app');
    const directives = createCspDirectives({ isDev: false, allowedOrigins: ['https://rimalis.example'] });
    const scriptSources = directives.scriptSrc.map((entry) => (
      typeof entry === 'function' ? entry({}, { locals: { cspNonce: 'nonce-value' } }) : entry
    ));

    assert.match(scriptSources.join(' '), /'nonce-nonce-value'/);
    assert.doesNotMatch(scriptSources.join(' '), /'unsafe-inline'/);

    const styleSources = directives.styleSrc.join(' ');
    assert.doesNotMatch(styleSources, /'unsafe-inline'/);

    const html = '<html><body><script>console.log(1)</script><script src="/static/app.js"></script></body></html>';
    const withNonce = injectNonceIntoHtml(html, 'nonce-value');
    assert.match(withNonce, /<script nonce="nonce-value">console\.log\(1\)<\/script>/);
    assert.match(withNonce, /<script nonce="nonce-value" src="\/static\/app\.js"><\/script>/);
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (typeof value === 'undefined') delete process.env[key];
      else process.env[key] = value;
    }
    for (const id of modulesToClear) {
      delete require.cache[require.resolve(id)];
    }
  }
});

test('frontend templates and scripts stay free from broad inline execution regressions', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const templateFiles = walkFiles(path.join(repoRoot, 'frontend', 'templates'), new Set(['.html']));
  const scriptFiles = walkFiles(path.join(repoRoot, 'frontend', 'static', 'js'), new Set(['.js']));

  const templateViolations = [];
  for (const filePath of templateFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    if (/onclick\s*=|onchange\s*=|onsubmit\s*=|oninput\s*=|onload\s*=|javascript:/i.test(source)) {
      templateViolations.push(path.relative(repoRoot, filePath));
    }
  }

  const scriptViolations = [];
  const allowedHtmlSinkFiles = new Set([
    path.join(repoRoot, 'frontend', 'static', 'js', 'public', 'property-modal.js'),
    path.join(repoRoot, 'frontend', 'static', 'js', 'mobile', 'user', 'create-listing.js'),
    path.join(repoRoot, 'frontend', 'static', 'js', 'user', 'create-listing-desktop.js'),
  ]);
  const allowedHtmlSinkLinesByFile = new Map([
    [path.join(repoRoot, 'frontend', 'static', 'js', 'public', 'i18n.js'), new Set(['el.innerHTML = value;', 'if (canRenderI18nHtml(key)) el.innerHTML = dict[key];'])],
  ]);

  for (const filePath of scriptFiles) {
    if (allowedHtmlSinkFiles.has(filePath)) continue;
    const source = fs.readFileSync(filePath, 'utf8');
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!/(innerHTML|insertAdjacentHTML|outerHTML)/.test(line)) return;
      const allowedLines = allowedHtmlSinkLinesByFile.get(filePath);
      if (allowedLines?.has(line.trim())) return;
      scriptViolations.push(path.relative(repoRoot, filePath) + ':' + (index + 1));
    });
  }

  assert.deepEqual(templateViolations, []);
  assert.deepEqual(scriptViolations, []);
});

test('production env validation rejects weak JWT secrets and missing trust proxy', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    TRUST_PROXY: process.env.TRUST_PROXY,
  };

  const loadEnvModule = () => {
    delete require.cache[require.resolve('../config/env')];
    return require('../config/env');
  };

  try {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://rimalis.example';
    process.env.TRUST_PROXY = 'true';
    process.env.JWT_ACCESS_SECRET = 'change_me_access_secret';
    process.env.JWT_REFRESH_SECRET = 'this-is-a-very-strong-refresh-secret-123456789';
    assert.throws(() => loadEnvModule(), /JWT secrets must be strong, unique, and at least 32 characters in production/);

    process.env.JWT_ACCESS_SECRET = 'this-is-a-very-strong-access-secret-1234567890';
    process.env.JWT_REFRESH_SECRET = 'this-is-a-very-strong-refresh-secret-123456789';
    process.env.TRUST_PROXY = 'false';
    assert.throws(() => loadEnvModule(), /TRUST_PROXY must be true in production/);
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (typeof value === 'undefined') delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[require.resolve('../config/env')];
  }
});

test('weak secret helper flags common unsafe secret values', () => {
  const { isWeakSecret } = require('../config/env');
  assert.equal(isWeakSecret('change_me_access_secret'), true);
  assert.equal(isWeakSecret('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), true);
  assert.equal(isWeakSecret('short-secret'), true);
  assert.equal(isWeakSecret('this-is-a-very-strong-access-secret-1234567890'), false);
});

test('media sign limiter is configured and upload multer errors are normalized', async () => {
  assert.equal(typeof mediaSignLimiter, 'function');

  const tooLarge = await new Promise((resolve) => {
    handleMulterErrors(new multer.MulterError('LIMIT_FILE_SIZE'), {}, {}, (err) => resolve(err));
  });
  assert.equal(tooLarge.statusCode, 413);

  const tooManyFiles = await new Promise((resolve) => {
    handleMulterErrors(new multer.MulterError('LIMIT_UNEXPECTED_FILE'), {}, {}, (err) => resolve(err));
  });
  assert.equal(tooManyFiles.statusCode, 400);

  const tooManyParts = await new Promise((resolve) => {
    handleMulterErrors(new multer.MulterError('LIMIT_PART_COUNT'), {}, {}, (err) => resolve(err));
  });
  assert.equal(tooManyParts.statusCode, 400);
});

test('public property lookup only returns published listings', async () => {
  const propertyModel = require('../modules/properties/property.model');
  const propertyService = require('../modules/properties/property.service');
  const originalFindPublishedById = propertyModel.findPublishedById;

  try {
    const seen = [];
    propertyModel.findPublishedById = async (id) => {
      seen.push(id);
      if (id === 'listing-public') return { id, status: 'published' };
      return null;
    };

    const property = await propertyService.getProperty('public');
    assert.equal(property.id, 'listing-public');
    assert.deepEqual(seen, ['public', 'listing-public']);
  } finally {
    propertyModel.findPublishedById = originalFindPublishedById;
  }
});

test('public viewing access requires the property to be published', async () => {
  const viewingModel = require('../modules/viewings/viewing.model');
  const viewingService = require('../modules/viewings/viewing.service');
  const originalFindPublicProperty = viewingModel.findPublicProperty;
  const originalListPublicSlots = viewingModel.listPublicSlots;

  try {
    viewingModel.findPublicProperty = async () => null;
    await assert.rejects(() => viewingService.listPublicSlots('draft-property', {}), /Property not found/);

    viewingModel.findPublicProperty = async () => ({ id: 'published-property', owner_id: 'owner-1', title: 'Published' });
    viewingModel.listPublicSlots = async (propertyId) => [{ id: 'slot-1', propertyId }];
    const slots = await viewingService.listPublicSlots('published-property', {});
    assert.equal(slots[0].propertyId, 'published-property');
  } finally {
    viewingModel.findPublicProperty = originalFindPublicProperty;
    viewingModel.listPublicSlots = originalListPublicSlots;
  }
});

test('public reply token validation requires a UUID-shaped token', () => {
  const invalid = publicMessageReplyQuerySchema.safeParse({ token: 'not-a-real-token' });
  assert.equal(invalid.success, false);

  const valid = publicMessageReplyQuerySchema.safeParse({ token: '123e4567-e89b-12d3-a456-426614174000' });
  assert.equal(valid.success, true);
});

test('production env validation rejects weak signed-media config and insecure R2 endpoints', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    TRUST_PROXY: process.env.TRUST_PROXY,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    MEDIA_SIGNED_URL_ENABLED: process.env.MEDIA_SIGNED_URL_ENABLED,
    MEDIA_SIGNED_URL_SECRET: process.env.MEDIA_SIGNED_URL_SECRET,
    MEDIA_SIGNED_URL_BASE: process.env.MEDIA_SIGNED_URL_BASE,
  };

  const loadEnvModule = () => {
    delete require.cache[require.resolve('../config/env')];
    return require('../config/env');
  };

  try {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://rimalis.example';
    process.env.TRUST_PROXY = 'true';
    process.env.JWT_ACCESS_SECRET = 'this-is-a-very-strong-access-secret-1234567890';
    process.env.JWT_REFRESH_SECRET = 'this-is-a-very-strong-refresh-secret-123456789';

    process.env.MEDIA_SIGNED_URL_ENABLED = 'true';
    process.env.MEDIA_SIGNED_URL_SECRET = 'short-secret';
    assert.throws(() => loadEnvModule(), /MEDIA_SIGNED_URL_SECRET must be strong/);

    process.env.MEDIA_SIGNED_URL_SECRET = 'this-is-a-very-strong-media-secret-1234567890';
    process.env.STORAGE_DRIVER = 'r2';
    process.env.R2_ENDPOINT = 'http://example.com';
    process.env.R2_BUCKET = 'bucket';
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    assert.throws(() => loadEnvModule(), /R2_ENDPOINT must use https in production/);
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (typeof value === 'undefined') delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[require.resolve('../config/env')];
  }
});

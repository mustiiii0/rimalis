const express = require('express');
const fs = require('node:fs/promises');
const path = require('path');
const morgan = require('morgan');
const { v4: uuid } = require('uuid');
const { securityStack } = require('./config/security');
const { env } = require('./config/env');
const { apiLimiter } = require('./common/middleware/rate-limit');
const { apiRoutes } = require('./routes/index.routes');
const { notFound } = require('./common/middleware/not-found');
const { errorHandler } = require('./common/middleware/error-handler');

const app = express();
const frontendRoot = path.resolve(__dirname, '../../frontend');

app.disable('x-powered-by');

if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  req.requestId = uuid();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

securityStack(app);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(
  morgan('combined', {
    skip: (req) => req.originalUrl === '/health',
  })
);

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', service: 'backend' });
});

function isMobileUserAgent(ua = '') {
  return /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(String(ua));
}

function isTemplateHtmlRequest(req) {
  return req.method === 'GET' && req.path.startsWith('/templates/') && req.path.endsWith('.html');
}

function injectNonceIntoHtml(html, nonce) {
  if (!nonce) return html;
  return html.replace(/<script(?![^>]*\bnonce=)/g, `<script nonce=\"${nonce}\"`);
}

async function sendHtmlWithNonce(res, filePath) {
  const html = await fs.readFile(filePath, 'utf8');
  const body = injectNonceIntoHtml(html, res.locals.cspNonce);
  res.type('html');
  res.send(body);
}

const mobileTemplateSections = ['public', 'auth', 'legal', 'user'];

const staticOptions = env.nodeEnv === 'development'
  ? {
      etag: false,
      lastModified: false,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      },
    }
  : undefined;

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const pathName = req.path || '';
  const matchingSection = mobileTemplateSections.find((section) => pathName.startsWith(`/templates/${section}/`));
  if (!matchingSection) return next();
  if (pathName.startsWith('/templates/mobile/')) return next();
  if (req.query?.desktop === '1') return next();
  if (!isMobileUserAgent(req.headers['user-agent'])) return next();

  const mobilePath = pathName.replace(`/templates/${matchingSection}/`, `/templates/mobile/${matchingSection}/`);
  const query = new URLSearchParams(req.query || {});
  query.delete('desktop');
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return res.redirect(302, `${mobilePath}${suffix}`);
});
app.use('/static', express.static(path.join(frontendRoot, 'static'), staticOptions));
app.use(async (req, res, next) => {
  if (!isTemplateHtmlRequest(req)) return next();

  const relativePath = req.path.replace(/^\/templates\//, '');
  const filePath = path.resolve(frontendRoot, 'templates', relativePath);
  const templatesRoot = path.resolve(frontendRoot, 'templates');
  if (!filePath.startsWith(`${templatesRoot}${path.sep}`)) return next();

  try {
    await fs.access(filePath);
    return await sendHtmlWithNonce(res, filePath);
  } catch (_err) {
    return next();
  }
});
app.use('/templates', express.static(path.join(frontendRoot, 'templates'), staticOptions));
app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(frontendRoot, 'static', 'sitemap.xml'));
});
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(frontendRoot, 'static', 'robots.txt'));
});
app.get('/', (_req, res) => {
  res.redirect('/templates/public/home.html');
});

app.use('/api', apiLimiter, apiRoutes);

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return next();
  if (req.path === '/api') return next();
  if (req.path === '/health' || req.path === '/sitemap.xml' || req.path === '/robots.txt') return next();
  if (req.path.startsWith('/static/')) return next();
  if (req.path === '/templates/public/404.html' || req.path === '/templates/mobile/public/404.html') return next();

  const notFoundPath = isMobileUserAgent(req.headers['user-agent']) && req.query?.desktop !== '1'
    ? path.join(frontendRoot, 'templates', 'mobile', 'public', '404.html')
    : path.join(frontendRoot, 'templates', 'public', '404.html');
  return sendHtmlWithNonce(res.status(404), notFoundPath).catch(next);
});

app.use(notFound);
app.use(errorHandler);

module.exports = { app, injectNonceIntoHtml };

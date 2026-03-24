const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const crypto = require('node:crypto');
const { env } = require('./env');
const { AppError } = require('../common/errors/app-error');

function isAllowedDevOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
}

function getAllowedOrigins() {
  const fromEnv = env.corsOrigin.filter(Boolean);
  if (env.nodeEnv === 'production') {
    return fromEnv;
  }

  return Array.from(
    new Set([
      ...fromEnv,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8000',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8000',
      'http://127.0.0.1:8080',
    ])
  );
}

function createCspDirectives({ isDev, allowedOrigins }) {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: isDev
      ? ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com']
      : [
          "'self'",
          (_req, res) => `'nonce-${res.locals.cspNonce}'`,
          'https://cdn.tailwindcss.com',
          'https://cdnjs.cloudflare.com',
        ],
    scriptSrcAttr: ["'none'"],
    styleSrc: [
      "'self'",
      'https://fonts.googleapis.com',
      'https://cdnjs.cloudflare.com',
      'https://cdn.jsdelivr.net',
    ],
    connectSrc:
      env.nodeEnv === 'production'
        ? ["'self'", 'https://nominatim.openstreetmap.org', 'https://maps.googleapis.com']
        : ["'self'", ...allowedOrigins, 'https://nominatim.openstreetmap.org', 'https://maps.googleapis.com'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
    frameSrc: ["'self'", 'https://www.google.com', 'https://maps.google.com', 'https://www.google.com/maps'],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: [],
  };
}

function securityStack(app) {
  const allowedOrigins = getAllowedOrigins();
  const isDev = env.nodeEnv !== 'production';
  const corsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (isDev && isAllowedDevOrigin(origin)) return cb(null, true);
      return cb(new AppError(403, 'CORS blocked'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  };

  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
  });

  app.use(
    helmet({
      hsts:
        env.nodeEnv === 'production'
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            }
          : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      noSniff: true,
      xssFilter: false,
      frameguard: { action: 'deny' },
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: isDev
        ? false
        : {
            directives: createCspDirectives({ isDev, allowedOrigins }),
          },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      originAgentCluster: true,
    })
  );

  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
    next();
  });

  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));

  app.use(cookieParser());
}

module.exports = { securityStack, createCspDirectives };

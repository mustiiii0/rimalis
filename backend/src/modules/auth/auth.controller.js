const crypto = require('crypto');
const service = require('./auth.service');
const { env } = require('../../config/env');
const { CSRF_COOKIE_NAME } = require('../../common/middleware/csrf');

const REFRESH_COOKIE_NAME = 'rimalis_refresh_token';

function isProductionRuntime() {
  return String(process.env.NODE_ENV || env.nodeEnv) === 'production';
}

function refreshCookieOptions() {
  const isProd = isProductionRuntime();
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function csrfCookieOptions() {
  const isProd = isProductionRuntime();
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function setCsrfCookie(res) {
  res.cookie(CSRF_COOKIE_NAME, crypto.randomBytes(32).toString('hex'), csrfCookieOptions());
}

function getRefreshToken(req) {
  return req.cookies?.[REFRESH_COOKIE_NAME] || '';
}

async function register(req, res, next) {
  try {
    const user = await service.register(req.body);
    return res.status(201).json({ success: true, user });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const data = await service.login(req.body, {
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });
    if (data.requiresTwoFactor) {
      return res.json({
        success: true,
        requiresTwoFactor: true,
        challengeId: data.challengeId,
        message: data.message,
        devCode: data.devCode || null,
      });
    }
    res.cookie(REFRESH_COOKIE_NAME, data.refreshToken, refreshCookieOptions());
    setCsrfCookie(res);
    return res.json({
      success: true,
      accessToken: data.accessToken,
      user: data.user,
    });
  } catch (err) {
    return next(err);
  }
}

async function login2fa(req, res, next) {
  try {
    const data = await service.login2fa(req.body);
    res.cookie(REFRESH_COOKIE_NAME, data.refreshToken, refreshCookieOptions());
    setCsrfCookie(res);
    return res.json({
      success: true,
      accessToken: data.accessToken,
      user: data.user,
    });
  } catch (err) {
    return next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshToken = getRefreshToken(req);
    const data = await service.refresh({ refreshToken });
    res.cookie(REFRESH_COOKIE_NAME, data.refreshToken, refreshCookieOptions());
    setCsrfCookie(res);
    return res.json({
      success: true,
      accessToken: data.accessToken,
    });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = getRefreshToken(req);
    await service.logout({ refreshToken });
    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...refreshCookieOptions(),
      maxAge: 0,
    });
    res.clearCookie(CSRF_COOKIE_NAME, {
      ...csrfCookieOptions(),
      maxAge: 0,
    });
    return res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  login2fa,
  refresh,
  logout,
  refreshCookieOptions,
  csrfCookieOptions,
  REFRESH_COOKIE_NAME,
  isProductionRuntime,
};

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const { registerSchema } = require('../modules/auth/auth.validator');
const { requireAuth } = require('../common/middleware/auth');
const { requireRole } = require('../common/middleware/role-guard');
const { createAccessToken } = require('../common/utils/token');
const { refreshCookieOptions, csrfCookieOptions } = require('../modules/auth/auth.controller');
const { ROLES } = require('../common/constants/roles');

function runMiddleware(middleware, req = {}) {
  return new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err || null));
  });
}

test('register schema rejects weak password', () => {
  const result = registerSchema.safeParse({
    name: 'Erik Lind',
    email: 'support@rimalis.se',
    password: '123',
  });

  assert.equal(result.success, false);
});

test('requireAuth returns 401 when Authorization header is missing', async () => {
  const error = await runMiddleware(requireAuth, { headers: {} });

  assert.equal(error.statusCode, 401);
  assert.equal(error.message, 'Unauthorized');
});

test('requireAuth returns 401 on invalid bearer token', async () => {
  const error = await runMiddleware(requireAuth, {
    headers: { authorization: 'Bearer invalid.token.value' },
  });

  assert.equal(error.statusCode, 401);
  assert.equal(error.message, 'Invalid or expired token');
});

test('requireRole returns 403 when user role is not allowed', async () => {
  const guard = requireRole(ROLES.ADMIN);
  const error = await runMiddleware(guard, {
    user: { id: 'u1', role: ROLES.USER },
  });

  assert.equal(error.statusCode, 403);
  assert.equal(error.message, 'Forbidden');
});

test('requireRole allows admin users', async () => {
  const guard = requireRole(ROLES.ADMIN);
  const token = createAccessToken({
    sub: '00000000-0000-0000-0000-000000000001',
    email: 'support@rimalis.se',
    role: ROLES.ADMIN,
  });

  const req = {
    headers: { authorization: `Bearer ${token}` },
  };

  const authError = await runMiddleware(requireAuth, req);
  assert.equal(authError, null);
  assert.equal(req.user.role, ROLES.ADMIN);

  const roleError = await runMiddleware(guard, req);
  assert.equal(roleError, null);
});

test('production auth cookies stay strict and secure', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    const refreshOptions = refreshCookieOptions();
    assert.equal(refreshOptions.httpOnly, true);
    assert.equal(refreshOptions.secure, true);
    assert.equal(refreshOptions.sameSite, 'strict');
    assert.equal(refreshOptions.path, '/api/auth');

    const csrfOptions = csrfCookieOptions();
    assert.equal(csrfOptions.httpOnly, false);
    assert.equal(csrfOptions.secure, true);
    assert.equal(csrfOptions.sameSite, 'strict');
    assert.equal(csrfOptions.path, '/');
  } finally {
    if (typeof originalNodeEnv === 'undefined') delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test('development auth cookies stay usable locally without dropping path restrictions', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';

  try {
    const refreshOptions = refreshCookieOptions();
    assert.equal(refreshOptions.httpOnly, true);
    assert.equal(refreshOptions.secure, false);
    assert.equal(refreshOptions.sameSite, 'lax');
    assert.equal(refreshOptions.path, '/api/auth');

    const csrfOptions = csrfCookieOptions();
    assert.equal(csrfOptions.httpOnly, false);
    assert.equal(csrfOptions.secure, false);
    assert.equal(csrfOptions.sameSite, 'lax');
    assert.equal(csrfOptions.path, '/');
  } finally {
    if (typeof originalNodeEnv === 'undefined') delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

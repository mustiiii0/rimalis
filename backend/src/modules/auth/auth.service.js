const crypto = require('crypto');
const { ROLES } = require('../../common/constants/roles');
const { AppError } = require('../../common/errors/app-error');
const { hashPassword, comparePassword } = require('../../common/utils/password');
const { sendAdminTwoFactorEmail } = require('../../common/utils/mailer');
const { logError } = require('../../common/utils/logger');
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} = require('../../common/utils/token');
const {
  findUserByEmail,
  findUserById,
  createUser,
  createAdminLoginChallenge,
  findAdminLoginChallengeById,
  incrementAdminLoginChallengeAttempts,
  consumeAdminLoginChallenge,
  saveRefreshToken,
  hasRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokensForUser,
} = require('./auth.model');

const ADMIN_2FA_TTL_MINUTES = Number(process.env.ADMIN_2FA_TTL_MINUTES || 10);
const ADMIN_2FA_MAX_ATTEMPTS = Number(process.env.ADMIN_2FA_MAX_ATTEMPTS || 5);

function hashChallengeCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function timingSafeCodeEquals(inputCode, storedHash) {
  const inputHash = Buffer.from(hashChallengeCode(inputCode), 'hex');
  const knownHash = Buffer.from(String(storedHash || ''), 'hex');
  if (inputHash.length !== knownHash.length) return false;
  return crypto.timingSafeEqual(inputHash, knownHash);
}

function issueSessionTokens(user) {
  const basePayload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = createAccessToken(basePayload);
  const refreshToken = createRefreshToken(basePayload);
  return { accessToken, refreshToken };
}

async function register(payload) {
  const existing = await findUserByEmail(payload.email);
  if (existing) throw new AppError(409, 'Email already in use');

  const passwordHash = await hashPassword(payload.password);
  const user = await createUser({
    name: payload.name,
    email: payload.email,
    passwordHash,
    role: ROLES.USER,
    phone: payload.phone || null,
  });

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function login(payload, context = {}) {
  const user = await findUserByEmail(payload.email);
  if (!user) throw new AppError(401, 'Invalid credentials');

  const ok = await comparePassword(payload.password, user.passwordHash);
  if (!ok) throw new AppError(401, 'Invalid credentials');

  if (String(user.role || '').toLowerCase() === 'admin') {
    const challengeCode = String(crypto.randomInt(100000, 1000000));
    const challengeId = await createAdminLoginChallenge({
      userId: user.id,
      codeHash: hashChallengeCode(challengeCode),
      expiresAt: new Date(Date.now() + ADMIN_2FA_TTL_MINUTES * 60 * 1000),
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    const emailDelivery = await sendAdminTwoFactorEmail({
      toEmail: user.email,
      userName: user.name,
      code: challengeCode,
      ttlMinutes: ADMIN_2FA_TTL_MINUTES,
    });
    if (!emailDelivery?.sent) {
      logError('auth.admin_2fa.delivery_failed', {
        userId: user.id,
        toEmail: user.email,
        reason: emailDelivery?.reason || 'unknown',
        error: emailDelivery?.error || null,
      });
    }
    if (process.env.NODE_ENV === 'production' && !emailDelivery.sent) {
      throw new AppError(500, 'Could not deliver 2FA code');
    }

    return {
      requiresTwoFactor: true,
      challengeId,
      message: '2FA code sent to your email',
      devCode: process.env.NODE_ENV !== 'production' ? challengeCode : undefined,
    };
  }

  const tokens = issueSessionTokens(user);
  await saveRefreshToken({ userId: user.id, token: tokens.refreshToken });

  return {
    ...tokens,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

async function login2fa(payload) {
  const challenge = await findAdminLoginChallengeById(payload.challengeId);
  if (!challenge) throw new AppError(401, 'Invalid 2FA challenge');
  if (challenge.consumed_at) throw new AppError(401, '2FA challenge already used');
  if (challenge.attempts >= ADMIN_2FA_MAX_ATTEMPTS) throw new AppError(429, 'Too many 2FA attempts');
  if (new Date(challenge.expires_at).getTime() < Date.now()) throw new AppError(401, '2FA challenge expired');

  if (!timingSafeCodeEquals(payload.code, challenge.code_hash)) {
    await incrementAdminLoginChallengeAttempts(challenge.id);
    throw new AppError(401, 'Invalid 2FA code');
  }

  await consumeAdminLoginChallenge(challenge.id);

  const user = await findUserById(challenge.user_id);
  if (!user) throw new AppError(401, 'User not found');
  if (String(user.role || '').toLowerCase() !== 'admin') throw new AppError(403, '2FA required only for admin');

  const tokens = issueSessionTokens(user);
  await saveRefreshToken({ userId: user.id, token: tokens.refreshToken });

  return {
    ...tokens,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

async function refresh(payload) {
  const refreshToken = payload?.refreshToken;
  if (!refreshToken) throw new AppError(401, 'Refresh token missing');

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (_err) {
    throw new AppError(401, 'Invalid refresh token');
  }

  if (!(await hasRefreshToken(refreshToken))) {
    throw new AppError(401, 'Refresh token revoked');
  }

  const user = await findUserById(decoded.sub);
  if (!user) throw new AppError(401, 'User not found');

  await revokeRefreshToken(refreshToken);

  const basePayload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = createAccessToken(basePayload);
  const newRefreshToken = createRefreshToken(basePayload);
  await saveRefreshToken({ userId: user.id, token: newRefreshToken });

  return { accessToken, refreshToken: newRefreshToken };
}

async function logout(payload) {
  const refreshToken = payload?.refreshToken;
  if (!refreshToken) return;
  await revokeRefreshToken(refreshToken);
}

async function revokeAllSessionsForUser(userId) {
  await revokeRefreshTokensForUser(userId);
}

module.exports = { register, login, login2fa, refresh, logout, revokeAllSessionsForUser };

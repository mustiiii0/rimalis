const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch (_err) {
    return false;
  }
}

function boolEnv(name) {
  return String(process.env[name] || '').trim().toLowerCase() === 'true';
}

function nonEmpty(name) {
  return String(process.env[name] || '').trim();
}

function strongSecret(value) {
  const secret = String(value || '').trim();
  if (!secret || secret.length < 32) return false;
  if (/^(.)\1{15,}$/.test(secret)) return false;
  if (['change_me_access_secret', 'change_me_refresh_secret', 'dev-access-secret', 'dev-refresh-secret', 'secret', 'changeme', 'password', 'test-secret'].includes(secret)) {
    return false;
  }
  return true;
}

async function checkRemoteHealth(baseUrl) {
  const target = `${baseUrl.replace(/\/+$/, '')}/health`;
  const result = { ok: false, target, status: null, headers: {} };
  try {
    const response = await fetch(target, { redirect: 'manual' });
    result.status = response.status;
    result.headers = {
      'content-security-policy': response.headers.get('content-security-policy'),
      'x-content-type-options': response.headers.get('x-content-type-options'),
      'x-frame-options': response.headers.get('x-frame-options'),
      'permissions-policy': response.headers.get('permissions-policy'),
      'strict-transport-security': response.headers.get('strict-transport-security'),
    };
    result.ok = response.ok;
  } catch (err) {
    result.error = err.message || 'request failed';
  }
  return result;
}

async function main() {
  const findings = [];
  const warns = [];
  const infos = [];

  const nodeEnv = nonEmpty('NODE_ENV') || 'development';
  const corsOrigin = nonEmpty('CORS_ORIGIN');
  const trustProxy = boolEnv('TRUST_PROXY');
  const storageDriver = nonEmpty('STORAGE_DRIVER') || 'local';
  const mediaSignedUrlEnabled = boolEnv('MEDIA_SIGNED_URL_ENABLED');
  const probeUrl = nonEmpty('PRODUCTION_BASE_URL');

  if (nodeEnv !== 'production') {
    warns.push(`NODE_ENV is '${nodeEnv}', not 'production'`);
  }

  if (!corsOrigin) findings.push('CORS_ORIGIN is missing');
  if (!trustProxy) findings.push('TRUST_PROXY must be true behind a real proxy/TLS terminator');
  if (!strongSecret(nonEmpty('JWT_ACCESS_SECRET'))) findings.push('JWT_ACCESS_SECRET is missing or weak');
  if (!strongSecret(nonEmpty('JWT_REFRESH_SECRET'))) findings.push('JWT_REFRESH_SECRET is missing or weak');
  if (!['local', 'r2'].includes(storageDriver)) findings.push(`STORAGE_DRIVER must be 'local' or 'r2', got '${storageDriver}'`);

  if (storageDriver === 'r2') {
    if (!nonEmpty('R2_ENDPOINT')) findings.push('R2_ENDPOINT is missing');
    if (!nonEmpty('R2_BUCKET')) findings.push('R2_BUCKET is missing');
    if (!nonEmpty('R2_ACCESS_KEY_ID')) findings.push('R2_ACCESS_KEY_ID is missing');
    if (!nonEmpty('R2_SECRET_ACCESS_KEY')) findings.push('R2_SECRET_ACCESS_KEY is missing');
    if (nonEmpty('R2_ENDPOINT') && !isHttpsUrl(nonEmpty('R2_ENDPOINT'))) findings.push('R2_ENDPOINT must use https');
    if (nonEmpty('R2_PUBLIC_BASE_URL') && !isHttpsUrl(nonEmpty('R2_PUBLIC_BASE_URL'))) findings.push('R2_PUBLIC_BASE_URL must use https');
  }

  if (mediaSignedUrlEnabled) {
    if (!strongSecret(nonEmpty('MEDIA_SIGNED_URL_SECRET'))) {
      findings.push('MEDIA_SIGNED_URL_SECRET is missing or weak while signed media is enabled');
    }
    if (nonEmpty('MEDIA_SIGNED_URL_BASE') && !isHttpsUrl(nonEmpty('MEDIA_SIGNED_URL_BASE'))) {
      findings.push('MEDIA_SIGNED_URL_BASE must use https');
    }
  }

  infos.push(`storage driver: ${storageDriver}`);
  infos.push(`signed media: ${mediaSignedUrlEnabled ? 'enabled' : 'disabled'}`);
  infos.push(`trust proxy: ${trustProxy ? 'true' : 'false'}`);

  let remote = null;
  if (probeUrl) {
    remote = await checkRemoteHealth(probeUrl);
    if (!remote.ok) {
      warns.push(`remote health probe failed for ${remote.target}${remote.status ? ` (status ${remote.status})` : ''}${remote.error ? `: ${remote.error}` : ''}`);
    } else {
      if (!remote.headers['content-security-policy']) warns.push('remote response missing Content-Security-Policy header');
      if (!remote.headers['x-content-type-options']) warns.push('remote response missing X-Content-Type-Options header');
      if (!remote.headers['permissions-policy']) warns.push('remote response missing Permissions-Policy header');
      if (probeUrl.startsWith('https://') && !remote.headers['strict-transport-security']) {
        warns.push('remote https response missing Strict-Transport-Security header');
      }
    }
  }

  const lines = [];
  lines.push('Production readiness check');
  lines.push('');
  for (const info of infos) lines.push(`INFO: ${info}`);
  for (const warn of warns) lines.push(`WARN: ${warn}`);
  for (const finding of findings) lines.push(`FAIL: ${finding}`);
  if (remote) {
    lines.push('');
    lines.push(`Remote probe: ${remote.target}`);
    lines.push(`Status: ${remote.status ?? 'n/a'}`);
    Object.entries(remote.headers || {}).forEach(([name, value]) => {
      lines.push(`${name}: ${value || '(missing)'}`);
    });
  }
  lines.push('');
  lines.push(findings.length ? `RESULT: FAIL (${findings.length} blocking issue${findings.length === 1 ? '' : 's'})` : 'RESULT: PASS');

  console.log(lines.join('\n'));
  process.exitCode = findings.length ? 1 : 0;
}

main().catch((err) => {
  console.error(`FAIL: readiness check crashed: ${err.message || err}`);
  process.exitCode = 1;
});

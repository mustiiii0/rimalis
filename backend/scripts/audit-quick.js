#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const checks = [];

function ok(name, detail = '') {
  checks.push({ name, status: 'OK', detail });
}

function warn(name, detail = '') {
  checks.push({ name, status: 'WARN', detail });
}

function fail(name, detail = '') {
  checks.push({ name, status: 'FAIL', detail });
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

async function httpJson(url) {
  const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function run() {
  const base = process.env.AUDIT_BASE_URL || 'http://localhost:8080';

  // Static structure checks.
  exists('frontend/templates/public/home.html')
    ? ok('public.home.template')
    : fail('public.home.template', 'missing frontend/templates/public/home.html');
  exists('frontend/templates/user/dashboard.html')
    ? ok('user.dashboard.template')
    : fail('user.dashboard.template', 'missing frontend/templates/user/dashboard.html');
  exists('frontend/templates/admin/dashboard.html')
    ? ok('admin.dashboard.template')
    : fail('admin.dashboard.template', 'missing frontend/templates/admin/dashboard.html');

  exists('frontend/static/js/public/i18n.js')
    ? ok('public.i18n.js')
    : fail('public.i18n.js', 'missing frontend/static/js/public/i18n.js');
  exists('frontend/static/js/shared/api.js')
    ? ok('shared.api.js')
    : fail('shared.api.js', 'missing frontend/static/js/shared/api.js');

  // API health checks.
  try {
    const health = await httpJson(`${base}/health`);
    if (health.res.ok && health.body?.success === true) ok('api.health', `${base}/health`);
    else warn('api.health', `unexpected response ${health.res.status}`);
  } catch (err) {
    warn('api.health', `backend offline? ${err.message}`);
  }

  try {
    const api = await httpJson(`${base}/api`);
    if (api.res.ok && api.body?.success === true) ok('api.root', `${base}/api`);
    else warn('api.root', `status=${api.res.status}`);
  } catch (err) {
    warn('api.root', err.message);
  }

  // Basic hardening checks in code.
  const mainJs = path.join(root, 'frontend/static/js/public/main.js');
  const chatJs = path.join(root, 'frontend/static/js/public/chat.js');
  try {
    const mainText = fs.readFileSync(mainJs, 'utf8');
    if (mainText.includes('notification.textContent')) ok('xss.main.notification', 'textContent used');
    else warn('xss.main.notification', 'textContent not found for notification');
  } catch (err) {
    warn('xss.main.notification', err.message);
  }
  try {
    const chatText = fs.readFileSync(chatJs, 'utf8');
    if (chatText.includes("bubble.textContent = String(text || '')")) ok('xss.chat.message', 'safe chat rendering');
    else warn('xss.chat.message', 'safe chat rendering marker not found');
  } catch (err) {
    warn('xss.chat.message', err.message);
  }

  // Output.
  const width = Math.max(...checks.map((c) => c.name.length), 12) + 2;
  console.log('=== Rimalis Quick Audit ===');
  checks.forEach((c) => {
    const name = c.name.padEnd(width, ' ');
    const detail = c.detail ? ` | ${c.detail}` : '';
    console.log(`${c.status.padEnd(4, ' ')} ${name}${detail}`);
  });

  const hasFail = checks.some((c) => c.status === 'FAIL');
  process.exit(hasFail ? 1 : 0);
}

run().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});

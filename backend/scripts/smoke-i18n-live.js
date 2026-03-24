/* eslint-disable no-console */
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:8080';

function fail(message, details) {
  console.error(`I18N LIVE SMOKE FAIL: ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

async function fetchText(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  const text = await response.text();
  return { response, text };
}

async function fetchJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function expectStatus(response, expected, label) {
  if (response.status !== expected) {
    fail(`${label} expected ${expected} but got ${response.status}`);
  }
}

function expect(condition, label) {
  if (!condition) fail(label);
}

function scriptSrcs(html) {
  const out = [];
  const re = /<script[^>]+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function applyTextReplacements(text, replacements) {
  if (!replacements || typeof replacements !== 'object') return text;
  let result = text;
  for (const [from, to] of Object.entries(replacements)) {
    if (!from || typeof from !== 'string') continue;
    if (typeof to !== 'string') continue;
    result = result.split(from).join(to);
  }
  return result;
}

function applyDataI18nAttributes(html, dict) {
  if (!dict || typeof dict !== 'object') return html;
  return html.replace(/(<[^>]*\sdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/[^>]+>)/g, (full, openTag, key, innerText, closeTag) => {
    if (!(key in dict)) return full;
    const translated = String(dict[key] ?? '');
    if (!translated) return full;
    return `${openTag}${translated}${closeTag}`;
  });
}

function visibleText(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureNoRawKeys(text, label) {
  const rawKeyPattern = /\b(?:admin|user|listing|property|common|nav|title|auth|home|areas|about|contact|search|filters)_[a-z0-9_]{2,}\b/g;
  const matches = Array.from(new Set((text.match(rawKeyPattern) || []).slice(0, 12)));
  if (matches.length) fail(`${label} contains raw keys`, matches.join(', '));
}

async function assertPageLiveReady(page) {
  const html = await fetchText(page);
  expectStatus(html.response, 200, page);

  const srcs = scriptSrcs(html.text);
  expect(srcs.some((s) => s.includes('/static/js/public/i18n.js')), `${page} missing i18n runtime`);

  // Verify at least one loaded script on the page listens for language-changed.
  let hasLiveListener = false;
  for (const src of srcs) {
    if (!src.startsWith('/static/js/')) continue;
    const js = await fetchText(src);
    if (!js.response.ok) continue;
    const body = js.text;
    if (body.includes('rimalis:language-changed') || body.includes('setLanguage(')) {
      hasLiveListener = true;
      break;
    }
  }
  expect(hasLiveListener, `${page} has no live language listener in loaded scripts`);

  return html.text;
}

async function main() {
  console.log(`Running i18n live smoke against ${BASE_URL}`);

  const health = await fetchJson('/health');
  expectStatus(health.response, 200, 'health');

  const en = await fetchJson('/static/i18n/en.json');
  const sv = await fetchJson('/static/i18n/sv.json');
  expectStatus(en.response, 200, 'en dictionary');
  expectStatus(sv.response, 200, 'sv dictionary');

  const pages = [
    '/templates/public/properties.html',
    '/templates/user/dashboard.html',
    '/templates/user/my_listings.html',
    '/templates/user/create_listing/step3_preview_submit.html',
    '/templates/user/create_listing/submitted_success.html',
  ];

  for (const page of pages) {
    const rawHtml = await assertPageLiveReady(page);
    const svView = applyDataI18nAttributes(applyTextReplacements(rawHtml, sv.body.text_replacements || {}), sv.body);
    const enView = applyDataI18nAttributes(applyTextReplacements(rawHtml, en.body.text_replacements || {}), en.body);
    const svText = visibleText(svView);
    const enText = visibleText(enView);
    ensureNoRawKeys(svText, `${page} sv`);
    ensureNoRawKeys(enText, `${page} en`);
    expect(svText !== enText, `${page} sv/en render approximation did not change`);
  }

  console.log('I18N LIVE SMOKE OK: live listener wiring + sv/en switching approximation verified');
}

main().catch((err) => fail('Unhandled error', err.stack || err.message));

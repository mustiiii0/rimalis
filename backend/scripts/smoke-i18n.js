/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:8080';
const SNAPSHOT_DIR = '/tmp/i18n_snapshots';

function fail(message, details) {
  console.error(`I18N SMOKE FAIL: ${message}`);
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

function expectIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    fail(`${label} missing expected content: ${needle}`);
  }
}

function expectKey(obj, key, label) {
  if (!obj || typeof obj !== 'object' || !(key in obj)) {
    fail(`${label} missing i18n key: ${key}`);
  }
}

function ensureSnapshotDir() {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

function pageSlug(page) {
  return page.replace(/^\/+/, '').replace(/[/.]+/g, '_');
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

function expectNoRawI18nKeys(text, label) {
  const rawKeyPattern = /\b(?:admin|user|listing|property|common|nav|title|auth|home|areas|about|contact|search|filters)_[a-z0-9_]{2,}\b/g;
  const matches = Array.from(new Set((text.match(rawKeyPattern) || []).slice(0, 12)));
  if (matches.length) {
    fail(`${label} contains raw i18n keys in visible text`, matches.join(', '));
  }
}

function expectNoForbiddenSwedish(text, label) {
  const forbidden = [
    'Översikt',
    'Favoriter',
    'Mina annonser',
    'Meddelanden',
    'Profil',
    'Logga ut',
    'Välkommen tillbaka',
    'Sparade favoriter',
    'Bokade visningar',
  ];

  const leaks = forbidden.filter((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^A-Za-zÅÄÖåäö])${escaped}([^A-Za-zÅÄÖåäö]|$)`);
    return regex.test(text);
  });
  if (leaks.length) {
    fail(`${label} contains Swedish leakage in EN render approximation`, leaks.join(', '));
  }
}

function writeSnapshot(page, lang, body) {
  const file = path.join(SNAPSHOT_DIR, `${pageSlug(page)}_${lang}.html`);
  fs.writeFileSync(file, body, 'utf8');
}

async function main() {
  console.log(`Running i18n smoke against ${BASE_URL}`);
  ensureSnapshotDir();

  const health = await fetchJson('/health');
  expectStatus(health.response, 200, 'health');

  const en = await fetchJson('/static/i18n/en.json');
  const sv = await fetchJson('/static/i18n/sv.json');
  expectStatus(en.response, 200, 'en dictionary');
  expectStatus(sv.response, 200, 'sv dictionary');

  const requiredKeys = [
    'title_home',
    'title_properties',
    'title_areas',
    'title_contact',
    'title_about',
    'title_faq',
    'search_btn',
    'nav_home',
    'nav_properties',
    'nav_areas',
    'nav_about',
    'nav_contact',
    'footer_privacy',
    'footer_terms',
    'footer_cookies',
    'areas_hero_title',
    'properties_hero_title',
    'about_hero_title',
    'contact_hero_title',
    'title_login',
    'title_register',
  ];

  requiredKeys.forEach((key) => {
    expectKey(en.body, key, 'en');
    expectKey(sv.body, key, 'sv');
  });

  const pages = [
    '/templates/public/home.html',
    '/templates/public/properties.html',
    '/templates/public/areas.html',
    '/templates/public/about.html',
    '/templates/public/contact.html',
    '/templates/public/faq.html',
    '/templates/auth/login.html',
    '/templates/legal/privacy.html',
    '/templates/user/dashboard.html',
    '/templates/user/my_listings.html',
    '/templates/user/create_listing/step3_preview_submit.html',
    '/templates/user/create_listing/submitted_success.html',
    '/templates/admin/dashboard.html',
  ];

  for (const page of pages) {
    const html = await fetchText(page);
    expectStatus(html.response, 200, page);
    expectIncludes(html.text, '/static/js/public/i18n.js', page);

    const approxSv = applyDataI18nAttributes(applyTextReplacements(html.text, sv.body.text_replacements || {}), sv.body);
    const approxEn = applyDataI18nAttributes(applyTextReplacements(html.text, en.body.text_replacements || {}), en.body);
    writeSnapshot(page, 'sv', approxSv);
    writeSnapshot(page, 'en', approxEn);
    expectNoForbiddenSwedish(approxEn, `${page} (EN)`);
    expectNoRawI18nKeys(visibleText(approxSv), `${page} (SV)`);
    expectNoRawI18nKeys(visibleText(approxEn), `${page} (EN)`);
  }

  console.log(`I18N SMOKE OK: dictionaries, page wiring, EN leakage and snapshots verified (${SNAPSHOT_DIR})`);
}

main().catch((err) => fail('Unhandled error', err.stack || err.message));

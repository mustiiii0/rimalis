/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND = path.join(ROOT, 'frontend');
const I18N_DIR = path.join(FRONTEND, 'static', 'i18n');
const SOURCES = [
  path.join(FRONTEND, 'templates'),
  path.join(FRONTEND, 'static', 'js'),
];

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walkFiles(startPath, out = []) {
  if (!fs.existsSync(startPath)) return out;
  const entries = fs.readdirSync(startPath, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(abs, out);
      continue;
    }
    if (entry.isFile()) out.push(abs);
  }
  return out;
}

function detectDuplicateTopLevelKeys(jsonText) {
  const duplicates = new Set();
  const seen = new Set();
  const keyRegex = /^\s*"([^"]+)"\s*:/gm;
  let match;
  while ((match = keyRegex.exec(jsonText))) {
    const key = match[1];
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates].sort();
}

function extractUsedKeysFromHtml(text) {
  const out = new Set();
  const attrs = [
    /data-i18n="([^"]+)"/g,
    /data-i18n-placeholder="([^"]+)"/g,
    /data-i18n-title="([^"]+)"/g,
  ];
  for (const re of attrs) {
    let m;
    while ((m = re.exec(text))) {
      const key = String(m[1] || '').trim();
      if (key) out.add(key);
    }
  }
  return out;
}

function extractUsedKeysFromJs(text) {
  const out = new Set();
  const patterns = [
    /\bi18n\(\s*['"`]([^'"`]+)['"`]/g,
    /\.t\?\.\(\s*['"`]([^'"`]+)['"`]/g,
    /\.t\(\s*['"`]([^'"`]+)['"`]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) {
      const key = String(m[1] || '').trim();
      if (!key || key.includes('${')) continue;
      out.add(key);
    }
  }
  return out;
}

function collectUsedKeys() {
  const used = new Set();
  for (const source of SOURCES) {
    const files = walkFiles(source, []);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!['.html', '.js'].includes(ext)) continue;
      const text = readText(file);
      const keys = ext === '.html' ? extractUsedKeysFromHtml(text) : extractUsedKeysFromJs(text);
      keys.forEach((k) => used.add(k));
    }
  }
  return used;
}

function parseDictionary(locale) {
  const filePath = path.join(I18N_DIR, `${locale}.json`);
  const text = readText(filePath);
  const parsed = JSON.parse(text);
  const keys = new Set(Object.keys(parsed));
  const duplicates = detectDuplicateTopLevelKeys(text);
  return { locale, filePath, keys, duplicates };
}

function fail(lines) {
  console.error('\nI18N QA LINT FAIL\n');
  lines.forEach((line) => console.error(line));
  process.exit(1);
}

function main() {
  const usedKeys = collectUsedKeys();
  const sv = parseDictionary('sv');
  const en = parseDictionary('en');

  const report = [];

  if (sv.duplicates.length) {
    report.push(`Duplicate keys in sv.json: ${sv.duplicates.join(', ')}`);
  }
  if (en.duplicates.length) {
    report.push(`Duplicate keys in en.json: ${en.duplicates.join(', ')}`);
  }

  const missingInSv = [...usedKeys].filter((k) => !sv.keys.has(k)).sort();
  const missingInEn = [...usedKeys].filter((k) => !en.keys.has(k)).sort();

  if (missingInSv.length) {
    report.push(`Missing in sv.json (${missingInSv.length}): ${missingInSv.slice(0, 40).join(', ')}${missingInSv.length > 40 ? ' ...' : ''}`);
  }
  if (missingInEn.length) {
    report.push(`Missing in en.json (${missingInEn.length}): ${missingInEn.slice(0, 40).join(', ')}${missingInEn.length > 40 ? ' ...' : ''}`);
  }

  const onlySv = [...sv.keys].filter((k) => !en.keys.has(k)).sort();
  const onlyEn = [...en.keys].filter((k) => !sv.keys.has(k)).sort();

  if (onlySv.length) {
    report.push(`Keys only in sv.json (${onlySv.length}): ${onlySv.slice(0, 40).join(', ')}${onlySv.length > 40 ? ' ...' : ''}`);
  }
  if (onlyEn.length) {
    report.push(`Keys only in en.json (${onlyEn.length}): ${onlyEn.slice(0, 40).join(', ')}${onlyEn.length > 40 ? ' ...' : ''}`);
  }

  if (report.length) {
    fail(report);
  }

  console.log(`I18N QA LINT OK: ${usedKeys.size} used keys verified, sv/en dictionaries are aligned.`);
}

main();

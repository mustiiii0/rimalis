#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const jsRoot = path.join(root, 'frontend', 'static', 'js');

const riskyPatterns = [
  /innerHTML\s*=/,
  /insertAdjacentHTML\s*\(/,
  /document\.write\s*\(/,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
];

const allowlist = [
  // Known safe placeholders / skeleton blocks with no user input.
  'frontend/static/js/public/property-modal.js',
];

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(jsRoot);
const findings = [];

for (const file of files) {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, idx) => {
    if (!riskyPatterns.some((rx) => rx.test(line))) return;
    findings.push({
      file: rel,
      line: idx + 1,
      code: line.trim(),
      allowlisted: allowlist.includes(rel),
    });
  });
}

console.log('=== Frontend XSS surface scan ===');
if (!findings.length) {
  console.log('No risky patterns found.');
  process.exit(0);
}

let risky = 0;
findings.forEach((f) => {
  const tag = f.allowlisted ? 'ALLOW' : 'RISK ';
  if (!f.allowlisted) risky += 1;
  console.log(`${tag} ${f.file}:${f.line}  ${f.code}`);
});

console.log(`\nTotal findings: ${findings.length}`);
console.log(`Non-allowlisted risks: ${risky}`);
process.exit(risky > 0 ? 1 : 0);


#!/usr/bin/env node
/* eslint-disable no-console */
const { execFileSync } = require('node:child_process');

function gitLsFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function isTrackedJunk(file) {
  if (file.endsWith('.DS_Store')) return true;
  if (file === 'backend/.env' || file === 'backend/.env.production') return true;
  if (file.startsWith('backend/logs/') && file.endsWith('.log')) return true;
  if (file.startsWith('frontend/static/uploads/') && file !== 'frontend/static/uploads/.gitkeep') return true;
  return false;
}

function main() {
  const files = gitLsFiles();
  const junk = files.filter(isTrackedJunk);
  if (!junk.length) {
    console.log('OK: no tracked junk files found');
    return;
  }

  console.error('FAIL: tracked junk files detected (remove them and rely on .gitignore)');
  junk.slice(0, 200).forEach((f) => console.error(`- ${f}`));
  if (junk.length > 200) console.error(`...and ${junk.length - 200} more`);
  process.exit(1);
}

main();


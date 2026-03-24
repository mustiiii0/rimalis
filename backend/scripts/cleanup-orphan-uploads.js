/* eslint-disable no-console */
const { pool } = require('../src/db/client');
const { cleanupOrphans } = require('../src/common/storage/cleanup-service');

function readArg(name, fallback = '') {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return String(hit.split('=').slice(1).join('=') || fallback).trim();
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const prefix = readArg('prefix', 'uploads/images/');
  const days = Number.parseInt(readArg('days', '30'), 10);
  const maxDelete = Number.parseInt(readArg('maxDelete', '5000'), 10);
  const apply = hasFlag('apply');

  const result = await cleanupOrphans({
    prefix,
    olderThanDays: days,
    apply,
    maxDelete,
  });

  console.log(`Storage driver: ${result.driver}`);
  console.log(`Prefix: ${result.prefix}`);
  console.log(`Referenced keys: ${result.referencedCount}`);
  console.log(`Objects scanned: ${result.scannedCount}`);
  console.log(`Orphans older than ${result.olderThanDays} days: ${result.orphanCount}`);
  console.log(`Potential reclaim: ${result.orphanMB} MB`);

  if (result.sampleOrphans?.length) {
    console.log('Sample keys:');
    result.sampleOrphans.slice(0, 20).forEach((item) => {
      console.log(`- ${item.key}`);
    });
  }

  if (apply) {
    console.log(`Deleted keys: ${result.deletedCount}`);
  } else {
    console.log('Dry run only. Add --apply to delete the orphan keys.');
  }
}

main()
  .catch((err) => {
    console.error('cleanup-orphan-uploads failed:', err?.stack || err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

const { query } = require('../../db/client');
const storage = require('./index');

function normalizePrefix(prefix, fallback = 'uploads/images/') {
  const value = String(prefix || fallback).trim().replaceAll('\\', '/').replace(/^\/+/, '');
  return value || fallback;
}

function normalizeDays(days, fallback = 30) {
  const n = Number.parseInt(String(days ?? fallback), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function normalizeMaxDelete(maxDelete, fallback = 5000) {
  const n = Number.parseInt(String(maxDelete ?? fallback), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 50000);
}

function bytesToMb(bytes) {
  return Number((Number(bytes || 0) / (1024 * 1024)).toFixed(2));
}

async function loadReferencedKeys() {
  const keySet = new Set();

  const listingRows = await query(
    `SELECT image_url, floor_plan_url, property_details
       FROM properties`
  );

  for (const row of listingRows.rows) {
    [row.image_url, row.floor_plan_url].forEach((url) => {
      const key = storage.extractKeyFromUrl(url);
      if (key) keySet.add(key);
    });

    if (Array.isArray(row.property_details?.imageUrls)) {
      row.property_details.imageUrls.forEach((url) => {
        const key = storage.extractKeyFromUrl(url);
        if (key) keySet.add(key);
      });
    }
  }

  const usersRows = await query('SELECT avatar_url FROM users');
  for (const row of usersRows.rows) {
    const key = storage.extractKeyFromUrl(row.avatar_url);
    if (key) keySet.add(key);
  }

  return keySet;
}

async function scanPrefix(prefix) {
  const normalizedPrefix = normalizePrefix(prefix);
  const objects = await storage.list(normalizedPrefix);
  const totalBytes = objects.reduce((sum, item) => sum + Number(item?.size || 0), 0);

  return {
    prefix: normalizedPrefix,
    objects,
    objectCount: objects.length,
    totalBytes,
    totalMB: bytesToMb(totalBytes),
  };
}

function filterOrphans({ objects, referencedKeys, olderThanDays }) {
  const cutoffMs = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  return objects.filter((item) => {
    const key = String(item?.key || '').trim();
    if (!key) return false;
    if (referencedKeys.has(key)) return false;

    const modified = item?.lastModified ? new Date(item.lastModified).getTime() : 0;
    if (!modified) return true;
    return modified < cutoffMs;
  });
}

async function estimateOrphans({ prefix = 'uploads/images/', olderThanDays = 30 }) {
  const safePrefix = normalizePrefix(prefix);
  const days = normalizeDays(olderThanDays, 30);
  const [referencedKeys, scanned] = await Promise.all([
    loadReferencedKeys(),
    scanPrefix(safePrefix),
  ]);

  const orphans = filterOrphans({
    objects: scanned.objects,
    referencedKeys,
    olderThanDays: days,
  });
  const orphanBytes = orphans.reduce((sum, item) => sum + Number(item?.size || 0), 0);

  return {
    driver: storage.getDriverName(),
    prefix: safePrefix,
    olderThanDays: days,
    referencedCount: referencedKeys.size,
    scannedCount: scanned.objectCount,
    scannedBytes: scanned.totalBytes,
    scannedMB: scanned.totalMB,
    orphanCount: orphans.length,
    orphanBytes,
    orphanMB: bytesToMb(orphanBytes),
    orphanItems: orphans.map((item) => ({
      key: item.key,
      size: Number(item?.size || 0),
      lastModified: item?.lastModified || null,
    })),
    orphanKeys: orphans.map((item) => item.key),
    sampleOrphans: orphans.slice(0, 25).map((item) => ({
      key: item.key,
      size: Number(item?.size || 0),
      lastModified: item?.lastModified || null,
    })),
  };
}

async function cleanupOrphans({ prefix = 'uploads/images/', olderThanDays = 30, apply = false, maxDelete = 5000 }) {
  const estimate = await estimateOrphans({ prefix, olderThanDays });
  const shouldApply = Boolean(apply);
  if (!shouldApply || !estimate.orphanCount) {
    return {
      ...estimate,
      apply: shouldApply,
      deletedCount: 0,
      deletedMB: 0,
      message: shouldApply ? 'No orphan objects to delete' : 'Dry run',
    };
  }

  const limit = normalizeMaxDelete(maxDelete, 5000);
  const targetKeys = estimate.orphanKeys.slice(0, limit);
  const deletedCount = await storage.deleteKeys(targetKeys);

  const deletedBytes = estimate.orphanItems
    .filter((item) => targetKeys.includes(item.key))
    .reduce((sum, item) => sum + Number(item.size || 0), 0);

  return {
    ...estimate,
    apply: true,
    deleteLimit: limit,
    deletedCount,
    deletedMB: bytesToMb(deletedBytes),
    message: `Deleted ${deletedCount} orphan objects`,
  };
}

module.exports = {
  bytesToMb,
  loadReferencedKeys,
  scanPrefix,
  estimateOrphans,
  cleanupOrphans,
};

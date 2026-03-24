const local = require('./local');
const path = require('node:path');
const signedUrl = require('./signed-url');

function getDriverName() {
  const value = String(process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();
  return value || 'local';
}

function getActiveDriver() {
  if (getDriverName() === 'r2') return require('./r2');
  return local;
}

async function saveBuffer(key, buffer, meta = {}) {
  return getActiveDriver().saveBuffer(key, buffer, meta);
}

async function deleteByUrl(url) {
  const activeDriver = getDriverName();
  const drivers = activeDriver === 'r2' ? [require('./r2'), local] : [local];

  for (const driver of drivers) {
    const key = driver.extractKeyFromUrl?.(url);
    if (!key) continue;

    // Delete all responsive variants for the same image stem (e.g. _w480.webp, _w960.avif, ...).
    const stemMatch = key.match(/^(.*)_w\d+\.[a-z0-9]+$/i);
    if (stemMatch && driver.list) {
      const stem = stemMatch[1];
      const parent = path.posix.dirname(stem);
      const items = await driver.list(parent === '.' ? '' : `${parent}/`);
      const related = items
        .map((item) => item.key)
        .filter((itemKey) => itemKey === key || itemKey.startsWith(`${stem}_w`) || itemKey.startsWith(`${stem}.`));

      if (related.length > 1 && driver.deleteKeys) {
        await driver.deleteKeys(related);
        return { deleted: true, key, deletedKeys: related.length };
      }
      for (const itemKey of related) {
        await driver.deleteKey(itemKey);
      }
      return { deleted: true, key, deletedKeys: related.length || 1 };
    }

    await driver.deleteKey(key);
    return { deleted: true, key, deletedKeys: 1 };
  }
  return { deleted: false, key: null };
}

async function deleteByUrls(urls = []) {
  const unique = [...new Set(
    urls
      .map((x) => String(x || '').trim())
      .filter(Boolean)
  )];
  const results = [];
  for (const url of unique) {
    try {
      results.push(await deleteByUrl(url));
    } catch (err) {
      results.push({ deleted: false, key: null, error: err.message || 'delete failed' });
    }
  }
  return results;
}

function extractKeyFromUrl(input) {
  const activeDriver = getDriverName();
  const drivers = activeDriver === 'r2' ? [require('./r2'), local] : [local];
  for (const driver of drivers) {
    const key = driver.extractKeyFromUrl?.(input);
    if (key) return key;
  }
  return null;
}

async function list(prefix = '') {
  const driver = getActiveDriver();
  if (!driver.list) return [];
  return driver.list(prefix);
}

async function deleteKeys(keys = []) {
  const driver = getActiveDriver();
  if (driver.deleteKeys) {
    return driver.deleteKeys(keys);
  }
  let deleted = 0;
  for (const key of keys) {
    try {
      await driver.deleteKey(key);
      deleted += 1;
    } catch (_err) {
      // best-effort cleanup
    }
  }
  return deleted;
}

async function getObject(key) {
  const driver = getActiveDriver();
  if (!driver.getObject) {
    throw new Error('Active storage driver does not support object reads');
  }
  return driver.getObject(key);
}

function createSignedMediaUrlFromUrl(url, expiresInSeconds) {
  if (!signedUrl.isEnabled()) return null;
  const key = extractKeyFromUrl(url);
  if (!key) return null;
  const token = signedUrl.createMediaToken(key, expiresInSeconds);
  return signedUrl.buildSignedMediaUrl(token);
}

module.exports = {
  saveBuffer,
  getDriverName,
  deleteByUrl,
  deleteByUrls,
  extractKeyFromUrl,
  list,
  deleteKeys,
  getObject,
  createSignedMediaUrlFromUrl,
};

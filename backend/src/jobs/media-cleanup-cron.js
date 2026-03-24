const { logInfo, logError } = require('../common/utils/logger');
const { cleanupOrphans } = require('../common/storage/cleanup-service');
const { broadcastAdminEvent } = require('../realtime/admin-live');

const DEFAULT_TIME = '03:20';
const TICK_MS = 60 * 1000;

let timer = null;
let isRunning = false;
let lastRunDate = '';

function parseTime(value) {
  const raw = String(value || DEFAULT_TIME).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: 3, minute: 20, label: DEFAULT_TIME };
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return { hour: 3, minute: 20, label: DEFAULT_TIME };
  }
  return { hour, minute, label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

function toLocalDateStamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function runCleanup(config) {
  if (isRunning) return;
  isRunning = true;
  const start = Date.now();

  try {
    const result = await cleanupOrphans({
      prefix: config.prefix,
      olderThanDays: config.days,
      apply: true,
      maxDelete: config.maxDelete,
    });

    logInfo('media.cleanup.cron.completed', {
      prefix: config.prefix,
      olderThanDays: config.days,
      deletedCount: result.deletedCount,
      orphanCount: result.orphanCount,
      scannedCount: result.scannedCount,
      ms: Date.now() - start,
    });
    broadcastAdminEvent('media.updated', {
      source: 'cron',
      deletedCount: result.deletedCount,
      orphanCount: result.orphanCount,
      scannedCount: result.scannedCount,
    });
  } catch (err) {
    logError('media.cleanup.cron.failed', {
      prefix: config.prefix,
      error: err?.message || 'unknown',
    });
  } finally {
    isRunning = false;
  }
}

function startMediaCleanupCron(options = {}) {
  const enabled = options.enabled === true;
  if (!enabled) return { started: false, reason: 'disabled' };
  if (timer) return { started: true, reason: 'already-started' };

  const parsed = parseTime(options.time);
  const config = {
    hour: parsed.hour,
    minute: parsed.minute,
    timeLabel: parsed.label,
    prefix: String(options.prefix || 'uploads/images/').trim() || 'uploads/images/',
    days: Number.parseInt(String(options.days || 30), 10) || 30,
    maxDelete: Number.parseInt(String(options.maxDelete || 5000), 10) || 5000,
  };

  timer = setInterval(() => {
    const now = new Date();
    const day = toLocalDateStamp(now);
    if (now.getHours() !== config.hour || now.getMinutes() !== config.minute) return;
    if (lastRunDate === day) return;
    lastRunDate = day;
    runCleanup(config);
  }, TICK_MS);

  logInfo('media.cleanup.cron.started', {
    runAt: config.timeLabel,
    prefix: config.prefix,
    olderThanDays: config.days,
    maxDelete: config.maxDelete,
  });

  if (options.runOnStart === true) {
    runCleanup(config);
  }

  return { started: true, reason: 'ok', config };
}

module.exports = { startMediaCleanupCron };

const viewingService = require('../modules/viewings/viewing.service');
const { logInfo, logError } = require('../common/utils/logger');

const TICK_MS = 60 * 1000;
let timer = null;
let running = false;

async function tickViewingReminders() {
  if (running) return;
  running = true;
  try {
    const result = await viewingService.processViewingReminders({ now: new Date() });
    if (result?.sent) {
      logInfo('viewing.reminders.sent', { sent: result.sent });
    }
  } catch (err) {
    logError('viewing.reminders.failed', { error: err?.message || 'unknown' });
  } finally {
    running = false;
  }
}

function startViewingReminderQueue() {
  if (timer) return;
  timer = setInterval(() => {
    tickViewingReminders();
  }, TICK_MS);
  tickViewingReminders();
  logInfo('viewing.reminders.started', { tickMs: TICK_MS });
}

module.exports = {
  startViewingReminderQueue,
  tickViewingReminders,
};

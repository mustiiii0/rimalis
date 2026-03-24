const http = require('node:http');
const { app } = require('./app');
const { env } = require('./config/env');
const { logInfo } = require('./common/utils/logger');
const { startMediaCleanupCron } = require('./jobs/media-cleanup-cron');
const { startSupportReplyQueue } = require('./jobs/support-reply-queue');
const { startViewingReminderQueue } = require('./jobs/viewing-reminders');
const { setupAdminLive } = require('./realtime/admin-live');

const server = http.createServer(app);
setupAdminLive(server);

server.listen(env.port, () => {
  logInfo('Backend started', { port: env.port, env: env.nodeEnv });
  startMediaCleanupCron({
    enabled: env.mediaCleanupCronEnabled,
    time: env.mediaCleanupCronTime,
    days: env.mediaCleanupOlderThanDays,
    prefix: env.mediaCleanupPrefix,
    maxDelete: env.mediaCleanupMaxDelete,
    runOnStart: env.mediaCleanupRunOnStart,
  });
  startSupportReplyQueue();
  startViewingReminderQueue();
});

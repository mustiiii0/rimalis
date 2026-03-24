const jobModel = require('../modules/support-reply-jobs/support-reply-job.model');
const adminModel = require('../modules/admin/admin.model');
const notificationService = require('../modules/notifications/notification.service');
const { sendSupportReplyEmail } = require('../common/utils/mailer');
const { logInfo, logError } = require('../common/utils/logger');
const { broadcastAdminEvent } = require('../realtime/admin-live');

const TICK_MS = 10 * 1000;
const CLAIM_BATCH = 5;

let timer = null;
let running = false;

function backoffMs(attempts) {
  const step = Math.max(1, Number(attempts || 1));
  return Math.min(10 * 60 * 1000, 15 * 1000 * (2 ** (step - 1)));
}

async function processJob(job) {
  const [settings, deliveryMeta] = await Promise.all([
    adminModel.getSettings(),
    adminModel.getMessageDeliveryMeta(job.message_id),
  ]);

  let emailOk = false;
  let inAppOk = false;

  if (job.recipient_email) {
    const emailRes = await sendSupportReplyEmail({
      smtpHost: settings?.smtpHost,
      smtpPort: settings?.smtpPort,
      smtpUser: settings?.smtpUser,
      supportEmail: settings?.supportEmail,
      toEmail: job.recipient_email,
      subject: job.subject,
      reply: job.reply_text,
      originalMessage: job.original_message || deliveryMeta?.originalMessage || '',
    });
    emailOk = Boolean(emailRes?.sent);
    if (!emailOk) {
      throw new Error(`email:${emailRes?.reason || 'delivery-failed'}`);
    }
  } else {
    emailOk = true;
  }

  if (job.recipient_user_id) {
    const notification = await notificationService.createUserNotification({
      userId: job.recipient_user_id,
      type: 'message.reply.admin',
      title: 'Nytt svar från support',
      body: job.subject || 'Du har fått ett nytt svar.',
      entityType: 'message',
      entityId: job.message_id,
      metadata: { messageId: job.message_id },
    });
    inAppOk = Boolean(notification?.id);
    if (!inAppOk) {
      throw new Error('in-app:failed');
    }
  } else {
    inAppOk = true;
  }

  if (!emailOk || !inAppOk) {
    throw new Error('delivery:partial');
  }
}

async function tickQueue() {
  if (running) return;
  running = true;

  try {
    const jobs = await jobModel.claimDue(CLAIM_BATCH);
    if (!jobs.length) return;

    for (const job of jobs) {
      try {
        await processJob(job);
        await jobModel.markSent(job.id);
        broadcastAdminEvent('support.updated', { messageId: job.message_id, source: 'reply-queue', state: 'sent' });
      } catch (err) {
        const reachedMax = Number(job.attempts || 0) >= Number(job.max_attempts || 7);
        const status = reachedMax ? 'failed' : 'retry';
        const nextAttemptAt = reachedMax
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + backoffMs(job.attempts));

        await jobModel.markRetry(job.id, {
          status,
          nextAttemptAt,
          error: err?.message || 'delivery-failed',
        });

        logError('support.reply.queue.job.failed', {
          jobId: job.id,
          messageId: job.message_id,
          attempts: job.attempts,
          maxAttempts: job.max_attempts,
          status,
          error: err?.message || 'unknown',
        });
      }
    }

    broadcastAdminEvent('support.updated', { source: 'reply-queue', state: 'batch-processed' });
  } catch (err) {
    logError('support.reply.queue.tick.failed', { error: err?.message || 'unknown' });
  } finally {
    running = false;
  }
}

function startSupportReplyQueue() {
  if (timer) return;
  timer = setInterval(() => {
    tickQueue();
  }, TICK_MS);

  tickQueue();
  logInfo('support.reply.queue.started', { tickMs: TICK_MS, batch: CLAIM_BATCH });
}

module.exports = {
  startSupportReplyQueue,
  tickQueue,
};

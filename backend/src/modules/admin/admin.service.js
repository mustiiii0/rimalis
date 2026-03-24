const { AppError } = require('../../common/errors/app-error');
const model = require('./admin.model');
const messageModel = require('../messages/message.model');
const { hashPassword } = require('../../common/utils/password');
const storageCleanup = require('../../common/storage/cleanup-service');
const storage = require('../../common/storage');
const { env } = require('../../config/env');
const supportReplyJobModel = require('../support-reply-jobs/support-reply-job.model');
const { broadcastAdminEvent } = require('../../realtime/admin-live');
const notificationService = require('../notifications/notification.service');
const { sendSupportReplyEmail } = require('../../common/utils/mailer');
const { logError } = require('../../common/utils/logger');
const { revokeAllSessionsForUser } = require('../auth/auth.service');
const { clearPublicPropertiesCache } = require('../properties/property.service');
const cache = require('../../common/cache');
const { userListingsCacheKey } = require('../users/user.service');
const { userFavoritesCacheKey } = require('../favorites/favorite.service');

async function dashboard() {
  return model.getStats();
}

async function users() {
  return model.listUsers();
}

async function createUser(payload) {
  const existing = await model.findUserByEmail(payload.email);
  if (existing) throw new AppError(409, 'Email already in use');

  const passwordHash = await hashPassword(payload.password);
  const created = await model.createUser({
    name: payload.name,
    email: payload.email,
    passwordHash,
    role: payload.role || 'user',
  });
  if (!created) throw new AppError(500, 'Could not create user');

  return {
    id: created.id,
    name: created.name,
    email: created.email,
    role: created.role,
    createdAt: created.created_at,
    status: 'active',
    lastLoginAt: null,
  };
}

async function updateUser(userId, payload, actorUserId) {
  const normalizedId = String(userId || '').trim();
  if (normalizedId && normalizedId === String(actorUserId || '').trim() && payload.role === 'user') {
    throw new AppError(400, 'You cannot remove your own admin access');
  }
  const updated = await model.updateUserRole(userId, payload.role);
  if (!updated) throw new AppError(404, 'User not found');
  return updated;
}

async function removeUser(userId, actorUserId) {
  const normalizedId = String(userId || '').trim();
  if (normalizedId && normalizedId === String(actorUserId || '').trim()) {
    throw new AppError(400, 'You cannot delete your own account');
  }
  const deleted = await model.softDeleteUser(userId, actorUserId);
  if (!deleted) throw new AppError(404, 'User not found');
  await revokeAllSessionsForUser(userId);
  clearPublicPropertiesCache();
  await cache.delMany([userListingsCacheKey(userId), userFavoritesCacheKey(userId)]);
  return { deleted: true };
}

async function restoreUser(userId) {
  const restored = await model.restoreUser(userId);
  if (!restored) throw new AppError(404, 'User not found');
  clearPublicPropertiesCache();
  await cache.delMany([userListingsCacheKey(userId), userFavoritesCacheKey(userId)]);
  return { restored: true, user: restored };
}

async function messages() {
  return messageModel.listAllForAdmin();
}

async function supportAgents() {
  return messageModel.listSupportAgents();
}

async function markRead(messageId) {
  const updated = await messageModel.markRead(messageId);
  if (!updated) throw new AppError(404, 'Message not found');
  broadcastAdminEvent('support.updated', { messageId, action: 'mark-read' });
  return updated;
}

async function updateMessageMeta(messageId, payload) {
  const meta = await messageModel.updateThreadMeta(messageId, {
    assigneeUserId: Object.prototype.hasOwnProperty.call(payload, 'assigneeUserId') ? payload.assigneeUserId : undefined,
    status: payload.status,
    priority: payload.priority,
  });
  broadcastAdminEvent('support.updated', { messageId, action: 'meta-updated' });
  return meta;
}

async function messageNotes(messageId) {
  return messageModel.listThreadNotes(messageId);
}

async function addMessageNote(messageId, note, adminUserId) {
  const notes = await messageModel.addThreadNote(messageId, adminUserId, note);
  broadcastAdminEvent('support.updated', { messageId, action: 'note-added' });
  return notes;
}

function deriveReference(message) {
  const subject = String(message?.subject || '');
  const match = subject.match(/\(([A-Z0-9-]{4,})\)/i);
  if (match?.[1]) return match[1];
  if (message?.propertyId) return String(message.propertyId);
  return '-';
}

function renderMacroText(template, message) {
  const ref = deriveReference(message);
  const name = String(message?.senderName || message?.userName || '').trim() || 'kund';
  return String(template || '')
    .replaceAll('{namn}', name)
    .replaceAll('{annons_ref}', ref);
}

async function bulkMessages(payload, adminUserId) {
  const ids = Array.from(new Set((payload.messageIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (!ids.length) return { changed: 0 };

  let changed = 0;
  const errors = [];

  if (payload.action === 'mark_read') {
    for (const id of ids) {
      try {
        const row = await messageModel.markRead(id);
        if (row) changed += 1;
      } catch (err) {
        errors.push({ id, error: err?.message || 'failed' });
      }
    }
  } else if (payload.action === 'assign') {
    for (const id of ids) {
      try {
        await messageModel.updateThreadMeta(id, { assigneeUserId: payload.assigneeUserId || null });
        changed += 1;
      } catch (err) {
        errors.push({ id, error: err?.message || 'failed' });
      }
    }
  } else if (payload.action === 'close') {
    for (const id of ids) {
      try {
        await messageModel.updateThreadMeta(id, { status: 'closed' });
        changed += 1;
      } catch (err) {
        errors.push({ id, error: err?.message || 'failed' });
      }
    }
  } else if (payload.action === 'reply_macro') {
    const all = await messageModel.listAllForAdmin();
    const byId = new Map(all.map((m) => [m.id, m]));
    for (const id of ids) {
      try {
        const m = byId.get(id);
        if (!m) throw new Error('Message not found');
        const replyText = renderMacroText(payload.macroText || '', m).trim();
        if (!replyText) throw new Error('Macro resolved to empty text');
        await reply(id, { reply: replyText }, adminUserId);
        changed += 1;
      } catch (err) {
        errors.push({ id, error: err?.message || 'failed' });
      }
    }
  } else {
    throw new AppError(400, 'Unsupported bulk action');
  }

  broadcastAdminEvent('support.updated', { action: 'bulk-updated', changed });
  return { changed, errors, total: ids.length };
}

async function supportMacros() {
  return messageModel.listMacros();
}

async function createSupportMacro(payload, adminUserId) {
  return messageModel.createMacro({
    name: payload.name,
    body: payload.body,
    createdBy: adminUserId || null,
  });
}

async function deleteSupportMacro(macroId) {
  const deleted = await messageModel.deleteMacro(macroId);
  if (!deleted) throw new AppError(404, 'Macro not found');
  return true;
}

async function reply(messageId, payload, adminUserId) {
  const updated = await messageModel.replyAsAdmin(messageId, adminUserId, payload.reply);
  if (!updated) throw new AppError(404, 'Message not found');
  const deliveryMeta = await model.getMessageDeliveryMeta(messageId);
  const recipientUserId = deliveryMeta?.recipientUserId || updated.userId || null;
  const recipientEmail = deliveryMeta?.recipientEmail || null;
  let queued = null;
  let queueError = null;

  try {
    queued = await supportReplyJobModel.enqueue({
      messageId: updated.id,
      adminUserId,
      recipientUserId,
      recipientEmail,
      subject: deliveryMeta?.subject || 'Support reply',
      originalMessage: deliveryMeta?.originalMessage || '',
      replyText: payload.reply,
    });
  } catch (err) {
    queueError = err;
    logError('support.reply.queue.enqueue.failed', {
      messageId: updated.id,
      error: err?.message || 'unknown',
      code: err?.code || null,
    });
  }

  let fallback = null;
  if (!queued && queueError) {
    let emailSent = false;
    let inAppSent = false;

    try {
      if (recipientEmail) {
        const settings = await model.getSettings();
        const emailRes = await sendSupportReplyEmail({
          smtpHost: settings?.smtpHost,
          smtpPort: settings?.smtpPort,
          smtpUser: settings?.smtpUser,
          supportEmail: settings?.supportEmail,
          toEmail: recipientEmail,
          subject: deliveryMeta?.subject || 'Support reply',
          reply: payload.reply,
          originalMessage: deliveryMeta?.originalMessage || '',
        });
        emailSent = Boolean(emailRes?.sent);
      } else {
        emailSent = true;
      }
    } catch (err) {
      logError('support.reply.fallback.email.failed', {
        messageId: updated.id,
        error: err?.message || 'unknown',
      });
    }

    try {
      if (recipientUserId) {
        const n = await notificationService.createUserNotification({
          userId: recipientUserId,
          type: 'message.reply.admin',
          title: 'Nytt svar från support',
          body: deliveryMeta?.subject || 'Du har fått ett nytt svar.',
          entityType: 'message',
          entityId: updated.id,
          metadata: { messageId: updated.id },
        });
        inAppSent = Boolean(n?.id);
      } else {
        inAppSent = true;
      }
    } catch (err) {
      logError('support.reply.fallback.in_app.failed', {
        messageId: updated.id,
        error: err?.message || 'unknown',
      });
    }

    fallback = {
      attempted: true,
      emailSent,
      inAppSent,
      ok: emailSent && inAppSent,
    };
  }

  broadcastAdminEvent('support.updated', { messageId, action: 'reply-queued', jobId: queued?.id || null });
  return {
    ...updated,
    replyDelivery: {
      queued: Boolean(queued?.id),
      queueJobId: queued?.id || null,
      status: queued?.status || (fallback ? (fallback.ok ? 'fallback-sent' : 'fallback-partial') : 'pending'),
      fallback,
    },
  };
}

async function auditEntries(filters) {
  return model.listAdminAuditEntries(filters || {});
}

async function settings() {
  const s = await model.getSettings();
  if (!s) throw new AppError(404, 'Settings not found');
  return s;
}

async function saveSettings(payload) {
  return model.updateSettings(payload);
}

async function siteControls() {
  return model.getSiteControls();
}

async function assertSiteControlAccess(actorUserId) {
  const controls = await model.getSiteControls();
  const actor = (controls.adminLevels || []).find((item) => item.userId === actorUserId);
  return {
    controls,
    level: actor?.adminLevel || 'content',
  };
}

async function saveSiteControls(payload, actorUserId, actorIp) {
  const { controls: existing, level } = await assertSiteControlAccess(actorUserId);
  const allowed = new Set(existing.pages.map((p) => p.slug));
  const normalizedPages = payload.pages.filter((page) => allowed.has(page.slug));
  if (!normalizedPages.length) throw new AppError(400, 'No valid pages in payload');

  if (level !== 'super') {
    if (Array.isArray(payload.adminLevels) && payload.adminLevels.length) {
      throw new AppError(403, 'Only super admin can change admin levels');
    }
    if (payload.maintenanceMode !== existing.maintenanceMode) {
      throw new AppError(403, 'Only super admin can change maintenance mode');
    }
  }

  if (Array.isArray(payload.adminLevels) && payload.adminLevels.length) {
    const hasSuper = payload.adminLevels.some((item) => item.adminLevel === 'super');
    if (!hasSuper) throw new AppError(400, 'At least one super admin is required');
  }

  return model.updateSiteControls(
    {
      maintenanceMode: payload.maintenanceMode,
      maintenanceMessage: payload.maintenanceMessage || '',
      maintenanceStartsAt: payload.maintenanceStartsAt || null,
      maintenanceEndsAt: payload.maintenanceEndsAt || null,
      banner: payload.banner || { enabled: false, text: '', level: 'info' },
      abHome: payload.abHome || { enabled: false, activeVariant: 'a' },
      sectionControls: payload.sectionControls || {},
      contentBlocks: payload.contentBlocks || {},
      redirectRules: payload.redirectRules || {},
      accessRules: payload.accessRules || {},
      adminLevels: payload.adminLevels || [],
      note: payload.note || '',
      pages: normalizedPages,
    },
    actorUserId,
    actorIp
  );
}

async function siteControlVersions() {
  return model.listSiteControlVersions(30);
}

async function siteControlAudit() {
  return model.listSiteControlAudit(60);
}

async function restoreSiteControlVersion(versionId, actorUserId, actorIp) {
  const { level } = await assertSiteControlAccess(actorUserId);
  if (level !== 'super') throw new AppError(403, 'Only super admin can restore versions');

  const version = await model.getSiteControlVersion(versionId);
  if (!version?.payload?.after) throw new AppError(404, 'Version not found');
  const snapshot = version.payload.after;
  if (!Array.isArray(snapshot.pages) || !snapshot.pages.length) {
    throw new AppError(400, 'Invalid snapshot');
  }

  return model.updateSiteControls(
    {
      ...snapshot,
      note: `restore:${versionId}`,
    },
    actorUserId,
    actorIp
  );
}

async function rotatePreviewToken(actorUserId, actorIp) {
  const { level } = await assertSiteControlAccess(actorUserId);
  if (level !== 'super') throw new AppError(403, 'Only super admin can rotate preview token');
  return model.rotateSitePreviewToken(actorUserId, actorIp);
}

async function mediaHealth() {
  const [imagesScan, avatarsScan, orphanEstimate, largestListings] = await Promise.all([
    storageCleanup.scanPrefix('uploads/images/'),
    storageCleanup.scanPrefix('uploads/avatars/'),
    storageCleanup.estimateOrphans({
      prefix: env.mediaCleanupPrefix || 'uploads/images/',
      olderThanDays: env.mediaCleanupOlderThanDays || 30,
    }),
    model.listLargestListingsByImageCount(8),
  ]);

  const objectSizeMap = new Map(
    (imagesScan.objects || []).map((item) => [String(item?.key || ''), Number(item?.size || 0)])
  );
  const orphanSet = new Set((orphanEstimate.orphanKeys || []).map((k) => String(k)));
  const scoredListings = (largestListings || []).map((item) => {
    const keys = Array.isArray(item.referencedKeys) ? item.referencedKeys : [];
    const storedBytes = keys.reduce((sum, key) => sum + Number(objectSizeMap.get(key) || 0), 0);
    const orphanHits = keys.filter((key) => orphanSet.has(key)).length;

    let score = 100;
    if (!item.hasPrimaryImage) score -= 25;
    if (item.imageCount < 1) score -= 40;
    else if (item.imageCount < 3) score -= 20;
    if (keys.length > 0 && orphanHits > 0) {
      score -= Math.min(30, Math.round((orphanHits / keys.length) * 30));
    }
    score = Math.max(0, score);

    return {
      ...item,
      totalImageBytes: storedBytes,
      totalImageMB: storageCleanup.bytesToMb(storedBytes),
      orphanKeyHits: orphanHits,
      orphanRisk: keys.length ? Number((orphanHits / keys.length).toFixed(2)) : 0,
      healthScore: score,
    };
  });

  return {
    driver: storage.getDriverName(),
    totalObjects: imagesScan.objectCount + avatarsScan.objectCount,
    totalBytes: imagesScan.totalBytes + avatarsScan.totalBytes,
    totalMB: storageCleanup.bytesToMb(imagesScan.totalBytes + avatarsScan.totalBytes),
    images: {
      objects: imagesScan.objectCount,
      bytes: imagesScan.totalBytes,
      mb: imagesScan.totalMB,
    },
    avatars: {
      objects: avatarsScan.objectCount,
      bytes: avatarsScan.totalBytes,
      mb: avatarsScan.totalMB,
    },
    orphanEstimate: {
      prefix: orphanEstimate.prefix,
      olderThanDays: orphanEstimate.olderThanDays,
      count: orphanEstimate.orphanCount,
      bytes: orphanEstimate.orphanBytes,
      mb: orphanEstimate.orphanMB,
      sample: orphanEstimate.sampleOrphans,
    },
    largestListings: scoredListings,
    cron: {
      enabled: env.mediaCleanupCronEnabled,
      time: env.mediaCleanupCronTime,
      olderThanDays: env.mediaCleanupOlderThanDays,
      prefix: env.mediaCleanupPrefix,
      maxDelete: env.mediaCleanupMaxDelete,
      runOnStart: env.mediaCleanupRunOnStart,
    },
  };
}

async function cleanupMedia(payload = {}) {
  const result = await storageCleanup.cleanupOrphans({
    prefix: payload.prefix || env.mediaCleanupPrefix || 'uploads/images/',
    olderThanDays: payload.olderThanDays || env.mediaCleanupOlderThanDays || 30,
    apply: payload.apply === true,
    maxDelete: payload.maxDelete || env.mediaCleanupMaxDelete || 5000,
  });
  broadcastAdminEvent('media.updated', {
    source: 'admin-cleanup',
    apply: result.apply,
    deletedCount: result.deletedCount,
    orphanCount: result.orphanCount,
  });

  return {
    driver: result.driver,
    prefix: result.prefix,
    olderThanDays: result.olderThanDays,
    scannedCount: result.scannedCount,
    scannedMB: result.scannedMB,
    orphanCount: result.orphanCount,
    orphanMB: result.orphanMB,
    apply: result.apply,
    deletedCount: result.deletedCount,
    deletedMB: result.deletedMB,
    message: result.message,
    sampleOrphans: result.sampleOrphans,
  };
}

module.exports = {
  dashboard,
  users,
  createUser,
  updateUser,
  removeUser,
  restoreUser,
  messages,
  supportAgents,
  markRead,
  reply,
  updateMessageMeta,
  messageNotes,
  addMessageNote,
  bulkMessages,
  supportMacros,
  createSupportMacro,
  deleteSupportMacro,
  settings,
  saveSettings,
  siteControls,
  saveSiteControls,
  siteControlVersions,
  siteControlAudit,
  restoreSiteControlVersion,
  rotatePreviewToken,
  auditEntries,
  mediaHealth,
  cleanupMedia,
};

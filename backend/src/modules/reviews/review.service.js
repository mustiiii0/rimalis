const { AppError } = require('../../common/errors/app-error');
const model = require('./review.model');
const { clearPublicPropertiesCache } = require('../properties/property.service');
const notificationService = require('../notifications/notification.service');

async function listQueue() {
  return model.listPending();
}

async function decide(reviewId, status) {
  const review = await model.setStatus(reviewId, status);
  if (!review) throw new AppError(404, 'Review not found');
  clearPublicPropertiesCache();
  const ownerId = review?.property?.ownerId;
  if (ownerId) {
    const approved = status === 'approved';
    await notificationService.notifyUserAndMaybeEmail({
      userId: ownerId,
      type: 'listing.review.status_changed',
      title: approved ? 'Annons godkänd' : 'Annons avvisad',
      body: approved
        ? `Din annons "${review.property?.title || ''}" är nu publicerad.`
        : `Din annons "${review.property?.title || ''}" blev inte godkänd.`,
      entityType: 'property',
      entityId: review.propertyId,
      metadata: { reviewId, status, propertyId: review.propertyId },
      sendEmail: true,
      emailSubject: approved ? 'Din annons är godkänd' : 'Din annons behöver uppdateras',
    });
  }
  return review;
}

module.exports = { listQueue, decide };

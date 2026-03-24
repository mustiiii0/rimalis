const service = require('./review.service');

async function list(req, res, next) {
  try {
    const reviews = await service.listQueue();
    return res.json({ success: true, reviews });
  } catch (err) {
    return next(err);
  }
}

async function patch(req, res, next) {
  try {
    const review = await service.decide(req.params.reviewId, req.body.status);
    return res.json({ success: true, review });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, patch };

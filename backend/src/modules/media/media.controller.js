const service = require('./media.service');

async function sign(req, res, next) {
  try {
    const signed = await service.createSignedUrlFromRawUrl(req.query?.url, req.query?.expiresInSeconds);
    return res.json({ success: true, ...signed });
  } catch (err) {
    return next(err);
  }
}

async function getPrivate(req, res, next) {
  try {
    const media = await service.resolvePrivateToken(req.params.token);
    res.setHeader('Content-Type', media.contentType);
    if (media.contentLength) {
      res.setHeader('Content-Length', String(media.contentLength));
    }
    res.setHeader('Cache-Control', 'private, max-age=300');

    if (media.bodyStream) {
      media.bodyStream.pipe(res);
      return;
    }

    if (media.buffer) {
      return res.status(200).send(media.buffer);
    }

    return res.status(404).json({ success: false, message: 'Media not found' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  sign,
  getPrivate,
};

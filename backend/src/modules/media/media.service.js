const storage = require('../../common/storage');
const { AppError } = require('../../common/errors/app-error');
const signedUrl = require('../../common/storage/signed-url');

function toStream(body) {
  if (!body) return null;
  if (typeof body.pipe === 'function') return body;
  if (typeof body.transformToWebStream === 'function') {
    const webStream = body.transformToWebStream();
    const { Readable } = require('node:stream');
    return Readable.fromWeb(webStream);
  }
  return null;
}

async function createSignedUrlFromRawUrl(rawUrl, expiresInSeconds) {
  const signed = storage.createSignedMediaUrlFromUrl(rawUrl, expiresInSeconds);
  if (!signed) throw new AppError(400, 'Could not sign media URL');
  return { signedUrl: signed };
}

async function resolvePrivateToken(token) {
  const verified = signedUrl.verifyMediaToken(token);
  if (!verified) {
    throw new AppError(401, 'Invalid or expired media token');
  }

  const object = await storage.getObject(verified.key);
  if (!object) throw new AppError(404, 'Media object not found');

  return {
    key: verified.key,
    contentType: object.contentType || 'application/octet-stream',
    contentLength: object.contentLength || null,
    bodyStream: toStream(object.bodyStream),
    buffer: object.buffer || null,
  };
}

module.exports = {
  createSignedUrlFromRawUrl,
  resolvePrivateToken,
};

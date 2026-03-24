const service = require('./public.service');

function ping(_req, res) {
  return res.json({ success: true, message: 'Public API up' });
}

async function getSiteControls(req, res, next) {
  try {
    const controls = await service.getSiteControls(req.query.preview || '');
    return res.json({ success: true, controls });
  } catch (err) {
    return next(err);
  }
}

module.exports = { ping, getSiteControls };

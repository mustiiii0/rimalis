const { Router } = require('express');
const { ping, getSiteControls } = require('./public.controller');

const router = Router();
router.get('/ping', ping);
router.get('/site-controls', getSiteControls);

module.exports = { publicRoutes: router };

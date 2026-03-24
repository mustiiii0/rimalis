const { Router } = require('express');
const { requireAuth } = require('../../common/middleware/auth');
const { validate } = require('../../common/middleware/validate');
const controller = require('./favorite.controller');
const { propertyIdParamSchema } = require('./favorite.validator');

const router = Router();

router.get('/me', requireAuth, controller.listMy);
router.post('/me/:propertyId', requireAuth, validate(propertyIdParamSchema, 'params'), controller.add);
router.delete('/me/:propertyId', requireAuth, validate(propertyIdParamSchema, 'params'), controller.remove);

module.exports = { favoriteRoutes: router };

const { Router } = require('express');
const { publicRoutes } = require('../modules/public/public.routes');
const { authRoutes } = require('../modules/auth/auth.routes');
const { userRoutes } = require('../modules/users/user.routes');
const { adminRoutes } = require('../modules/admin/admin.routes');
const { propertyRoutes } = require('../modules/properties/property.routes');
const { messageRoutes } = require('../modules/messages/message.routes');
const { favoriteRoutes } = require('../modules/favorites/favorite.routes');
const { reviewRoutes } = require('../modules/reviews/review.routes');
const { uploadRoutes } = require('../modules/uploads/upload.routes');
const { notificationRoutes } = require('../modules/notifications/notification.routes');
const { viewingRoutes } = require('../modules/viewings/viewing.routes');
const { mediaRoutes } = require('../modules/media/media.routes');

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Rimalis Group API',
    endpoints: {
      health: '/health',
      public: '/api/public/ping',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        login2fa: 'POST /api/auth/login/2fa',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout',
      },
      users: '/api/users/me (+ PATCH /api/users/me/password)',
      admin: '/api/admin/dashboard',
      properties: '/api/properties/public',
      uploads: 'POST /api/uploads/image',
      viewings: {
        publicSlots: 'GET /api/viewings/slots/public/:propertyId',
        book: 'POST /api/viewings/book',
        adminExport: 'GET /api/viewings/admin/bookings/export.csv',
      },
      notifications: '/api/notifications/me',
      media: {
        sign: 'GET /api/media/sign?url=...',
        private: 'GET /api/media/private/:token',
      },
    },
  });
});

router.use('/public', publicRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/properties', propertyRoutes);
router.use('/messages', messageRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/reviews', reviewRoutes);
router.use('/uploads', uploadRoutes);
router.use('/notifications', notificationRoutes);
router.use('/viewings', viewingRoutes);
router.use('/media', mediaRoutes);

module.exports = { apiRoutes: router };

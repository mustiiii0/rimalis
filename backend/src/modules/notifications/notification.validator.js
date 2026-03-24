const { z } = require('../../common/validators/common');

const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid(),
});

module.exports = {
  notificationIdParamSchema,
};

const { z } = require('../../common/validators/common');

const propertyIdParamSchema = z.object({
  propertyId: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid property id'),
});

module.exports = { propertyIdParamSchema };

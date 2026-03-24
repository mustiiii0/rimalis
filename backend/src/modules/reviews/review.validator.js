const { z } = require('../../common/validators/common');

const decideSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

module.exports = { decideSchema };

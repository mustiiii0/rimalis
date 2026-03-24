const { z, emailSchema, passwordSchema, sanitizeText } = require('../../common/validators/common');

const registerSchema = z.object({
  name: z
    .string()
    .max(100)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Name must be at least 2 characters' }),
  email: emailSchema,
  password: passwordSchema,
  phone: z
    .string()
    .max(40)
    .transform(sanitizeText)
    .optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

const login2faSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

module.exports = { registerSchema, loginSchema, refreshSchema, login2faSchema };

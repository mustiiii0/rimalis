const { z, sanitizeText } = require('../../common/validators/common');

const createMessageSchema = z.object({
  subject: z
    .string()
    .max(160)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Subject must be at least 2 characters' }),
  content: z
    .string()
    .max(5000)
    .transform(sanitizeText)
    .refine((value) => value.length >= 1, { message: 'Content is required' }),
});

const createPublicMessageSchema = z.object({
  propertyId: z
    .string()
    .max(120)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Property id is required' }),
  name: z
    .string()
    .max(120)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Name is required' }),
  email: z
    .string()
    .max(255)
    .optional()
    .default('')
    .transform((value) => sanitizeText(value).toLowerCase())
    .refine((value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'Email must be valid',
    }),
  phone: z
    .string()
    .max(40)
    .optional()
    .default('')
    .transform(sanitizeText),
  message: z
    .string()
    .max(5000)
    .transform(sanitizeText)
    .refine((value) => value.length >= 3, { message: 'Message is required' }),
}).refine((payload) => payload.email.length > 0 || payload.phone.length >= 5, {
  message: 'Email or phone is required',
  path: ['email'],
});

const messageIdParamSchema = z.object({
  messageId: z.string().uuid(),
});

const messageReplySchema = z.object({
  content: z
    .string()
    .max(5000)
    .transform(sanitizeText)
    .refine((value) => value.length >= 1, { message: 'Content is required' }),
});

const publicMessageReplyParamsSchema = z.object({
  messageId: z.string().uuid(),
});

const publicMessageReplyQuerySchema = z.object({
  token: z
    .string()
    .uuid({ message: 'Token must be a valid public reply token' }),
});

const publicReplyBodySchema = z.object({
  name: z
    .string()
    .max(120)
    .transform(sanitizeText)
    .optional()
    .default(''),
  email: z
    .string()
    .max(255)
    .optional()
    .default('')
    .transform((value) => sanitizeText(value).toLowerCase())
    .refine((value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'Email must be valid',
    }),
  phone: z
    .string()
    .max(40)
    .optional()
    .default('')
    .transform(sanitizeText),
  content: z
    .string()
    .max(5000)
    .transform(sanitizeText)
    .refine((value) => value.length >= 1, { message: 'Content is required' }),
});

module.exports = {
  createMessageSchema,
  createPublicMessageSchema,
  messageIdParamSchema,
  messageReplySchema,
  publicMessageReplyParamsSchema,
  publicMessageReplyQuerySchema,
  publicReplyBodySchema,
};

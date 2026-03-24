const { z, emailSchema, passwordSchema, sanitizeText } = require('../../common/validators/common');

const replyMessageSchema = z.object({
  reply: z
    .string()
    .max(5000)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Reply must be at least 2 characters' }),
});

const updateSettingsSchema = z.object({
  siteName: z
    .string()
    .max(100)
    .transform(sanitizeText)
    .refine((value) => value.length >= 1, { message: 'Site name is required' }),
  supportEmail: z.string().email(),
  contactPhone: z
    .string()
    .max(40)
    .transform(sanitizeText),
  smtpHost: z
    .string()
    .max(200)
    .transform(sanitizeText),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpUser: z
    .string()
    .max(200)
    .transform(sanitizeText),
  vatPercent: z.coerce.number().min(0).max(100),
  commissionPercent: z.coerce.number().min(0).max(100),
  fixedFee: z.coerce.number().int().min(0).max(10000000),
  sessionTimeoutMin: z.coerce.number().int().min(5).max(1440),
});

const messageIdParamSchema = z.object({
  messageId: z.string().uuid(),
});

const macroIdParamSchema = z.object({
  macroId: z.string().uuid(),
});

const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});

const createUserSchema = z.object({
  name: z
    .string()
    .max(100)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Name must be at least 2 characters' }),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['user', 'admin']).default('user'),
});

const updateUserSchema = z.object({
  role: z.enum(['user', 'admin']),
});


const siteControlItemSchema = z.object({
  slug: z
    .string()
    .max(80)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Slug is required' }),
  enabled: z.coerce.boolean(),
  showInNav: z.coerce.boolean(),
  maintenanceMessage: z
    .string()
    .max(300)
    .optional()
    .default('')
    .transform(sanitizeText),
});

const optionalDateTimeInputSchema = z
  .union([z.string().max(64), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const raw = String(value).trim();
    return raw.length ? raw : null;
  });

const updateSiteControlsSchema = z.object({
  maintenanceMode: z.coerce.boolean(),
  maintenanceMessage: z
    .string()
    .max(300)
    .optional()
    .default('')
    .transform(sanitizeText),
  maintenanceStartsAt: optionalDateTimeInputSchema.default(null),
  maintenanceEndsAt: optionalDateTimeInputSchema.default(null),
  banner: z
    .object({
      enabled: z.coerce.boolean().default(false),
      text: z.string().max(280).optional().default('').transform(sanitizeText),
      level: z.enum(['info', 'warning', 'success']).default('info'),
    })
    .optional()
    .default({ enabled: false, text: '', level: 'info' }),
  abHome: z
    .object({
      enabled: z.coerce.boolean().default(false),
      activeVariant: z.enum(['a', 'b']).default('a'),
    })
    .optional()
    .default({ enabled: false, activeVariant: 'a' }),
  sectionControls: z.record(z.string(), z.record(z.string(), z.coerce.boolean())).optional().default({}),
  contentBlocks: z.record(z.string(), z.string().max(5000)).optional().default({}),
  redirectRules: z
    .record(
      z.string(),
      z.object({
        enabled: z.coerce.boolean().default(false),
        to: z.string().max(400).optional().default('').transform(sanitizeText),
      })
    )
    .optional()
    .default({}),
  accessRules: z.record(z.string(), z.enum(['public', 'authenticated'])).optional().default({}),
  adminLevels: z
    .array(
      z.object({
        userId: z.string().uuid(),
        adminLevel: z.enum(['super', 'content']),
      })
    )
    .optional()
    .default([]),
  note: z.string().max(200).optional().default('').transform(sanitizeText),
  pages: z.array(siteControlItemSchema).min(1),
});

const siteControlVersionIdParamSchema = z.object({
  versionId: z.string().uuid(),
});

const auditQuerySchema = z.object({
  actorUserId: z.string().uuid().optional(),
  actionLike: z
    .string()
    .max(120)
    .optional()
    .transform((value) => (value ? sanitizeText(value) : undefined)),
  from: optionalDateTimeInputSchema.optional(),
  to: optionalDateTimeInputSchema.optional(),
  outcome: z.enum(['success', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

const mediaCleanupSchema = z.object({
  apply: z.coerce.boolean().optional().default(false),
  prefix: z
    .string()
    .max(300)
    .optional()
    .default('uploads/images/')
    .transform(sanitizeText),
  olderThanDays: z.coerce.number().int().min(0).max(3650).optional().default(30),
  maxDelete: z.coerce.number().int().min(1).max(50000).optional().default(5000),
});

const threadMetaSchema = z.object({
  assigneeUserId: z.string().uuid().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

const threadNoteSchema = z.object({
  note: z
    .string()
    .max(2000)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Note must be at least 2 characters' }),
});

const supportMacroSchema = z.object({
  name: z
    .string()
    .max(80)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Macro name must be at least 2 characters' }),
  body: z
    .string()
    .max(5000)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Macro body must be at least 2 characters' }),
});

const bulkMessagesSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(['mark_read', 'assign', 'close', 'reply_macro']),
  assigneeUserId: z.string().uuid().nullable().optional(),
  macroText: z.string().max(5000).optional().transform((value) => (value ? sanitizeText(value) : value)),
});

module.exports = {
  replyMessageSchema,
  updateSettingsSchema,
  messageIdParamSchema,
  macroIdParamSchema,
  userIdParamSchema,
  createUserSchema,
  updateUserSchema,
  updateSiteControlsSchema,
  siteControlVersionIdParamSchema,
  auditQuerySchema,
  mediaCleanupSchema,
  threadMetaSchema,
  threadNoteSchema,
  supportMacroSchema,
  bulkMessagesSchema,
};

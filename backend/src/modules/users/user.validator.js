const { z, sanitizeText, passwordSchema } = require('../../common/validators/common');

const PROPERTY_TYPES = ['Lägenhet', 'Villa/Hus', 'Odlingsmark', 'Byggmark', 'Villa', 'Radhus', 'Fritidshus', 'Gård'];

function emptyToUndefined(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

const optionalSanitizedString = (min, max, fieldName) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(max, `${fieldName} is too long`)
      .transform(sanitizeText)
      .refine((value) => value.length >= min, {
        message: `${fieldName} must be at least ${min} characters`,
      })
      .optional()
  );

const optionalAssetUrl = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .max(2048, 'URL is too long')
    .refine((value) => /^https?:\/\/.+/i.test(value) || /^\/static\/uploads\/.+/i.test(value) || /^\/api\/media\/private\/.+/i.test(value), {
      message: 'URL must be http(s), /static/uploads path, or /api/media/private path',
    })
    .optional()
);

const updateProfileSchema = z.object({
  name: z
    .string()
    .max(100)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Name must be at least 2 characters' })
    .optional(),
  email: z.preprocess(
    emptyToUndefined,
    z.string().email('Email must be valid').max(190).transform((value) => sanitizeText(value).toLowerCase()).optional()
  ),
  avatarUrl: optionalAssetUrl,
  phone: optionalSanitizedString(6, 40, 'Phone'),
  address: optionalSanitizedString(4, 240, 'Address'),
  postalCode: optionalSanitizedString(3, 20, 'Postal code'),
  city: optionalSanitizedString(2, 120, 'City'),
  country: optionalSanitizedString(2, 120, 'Country'),
  whatsappCountryCode: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(8, 'WhatsApp country code is too long')
      .transform(sanitizeText)
      .refine((value) => /^\+\d{1,4}$/.test(value), {
        message: 'WhatsApp country code must look like +46',
      })
      .optional()
  ),
  whatsappNumber: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(30, 'WhatsApp number is too long')
      .transform((value) => sanitizeText(value).replace(/[^\d]/g, ''))
      .refine((value) => /^\d{6,20}$/.test(value), {
        message: 'WhatsApp number must contain 6-20 digits',
      })
      .optional()
  ),
});

const createBookingSchema = z.object({
  propertyId: z.string().min(1).max(120),
  scheduledAt: z.string().datetime(),
});

const createSavedSearchSchema = z.object({
  name: z
    .string()
    .max(120)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Name must be at least 2 characters' }),
  criteria: z.record(z.string(), z.any()).default({}),
});

const patchMyListingStatusSchema = z.object({
  status: z.enum(['sold']),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

const createListingSchema = z.object({
  title: z
    .string()
    .max(180)
    .transform(sanitizeText)
    .refine((value) => value.length >= 3, { message: 'Title must be at least 3 characters' }),
  location: z
    .string()
    .max(180)
    .transform(sanitizeText)
    .refine((value) => value.length >= 2, { message: 'Location must be at least 2 characters' }),
  price: z.coerce.number().int().min(1).max(10_000_000_000),
  propertyType: z.preprocess(
    emptyToUndefined,
    z.enum(PROPERTY_TYPES).optional()
  ),
  livingArea: z.coerce.number().int().min(1).max(100000).optional(),
  rooms: z.coerce.number().int().min(1).max(1000).optional(),
  address: optionalSanitizedString(4, 240, 'Address'),
  description: optionalSanitizedString(20, 5000, 'Description'),
  imageUrl: optionalAssetUrl,
  imageUrls: z.array(optionalAssetUrl).max(30).optional(),
  videoUrl: optionalAssetUrl,
  floorPlanUrl: optionalAssetUrl,
  listingDetails: z.record(z.string(), z.any()).default({}),
}).superRefine((data, ctx) => {
  const details = data.listingDetails || {};
  const requireNumber = (key, label, min = 0) => {
    const val = details[key];
    if (val === undefined || val === null || val === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['listingDetails', key],
        message: `${label} is required`,
      });
      return;
    }
    const num = Number(val);
    if (!Number.isFinite(num) || num < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['listingDetails', key],
        message: `${label} must be a number >= ${min}`,
      });
    }
  };

  if (data.propertyType === 'Lägenhet') {
    requireNumber('area', 'Area', 1);
    requireNumber('rooms', 'Rooms', 0);
  }
  if (data.propertyType === 'Villa/Hus') {
    requireNumber('area', 'Area', 1);
    requireNumber('rooms', 'Rooms', 0);
  }
  if (data.propertyType === 'Odlingsmark' || data.propertyType === 'Byggmark') {
    requireNumber('area', 'Area', 1);
  }
});

module.exports = {
  updateProfileSchema,
  createBookingSchema,
  createSavedSearchSchema,
  createListingSchema,
  patchMyListingStatusSchema,
  changePasswordSchema,
};

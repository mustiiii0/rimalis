const { z, sanitizeText } = require('../../common/validators/common');

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

const patchStatusSchema = z.object({
  status: z.enum(['draft', 'pending', 'published', 'sold', 'rejected']),
});

const propertyIdParamSchema = z.object({
  id: z.string().max(120).transform(sanitizeText).refine((v) => v.length >= 3),
});

const softDeletePropertySchema = z.object({
  reason: z
    .string()
    .max(240)
    .optional()
    .default('')
    .transform(sanitizeText),
});

const createPropertySchema = z.object({
  title: z.string().max(180).transform(sanitizeText).refine((v) => v.length >= 3),
  propertyType: z.preprocess(emptyToUndefined, z.enum(PROPERTY_TYPES).optional()),
  price: z.coerce.number().int().min(1).max(10000000000),
  livingArea: z.coerce.number().int().min(1).max(100000).optional(),
  rooms: z.coerce.number().int().min(1).max(100).optional(),
  location: z.string().max(120).transform(sanitizeText).refine((v) => v.length >= 2),
  address: optionalSanitizedString(4, 300, 'Address'),
  description: optionalSanitizedString(20, 10000, 'Description'),
  imageUrl: optionalAssetUrl,
  videoUrl: optionalAssetUrl,
  floorPlanUrl: optionalAssetUrl,
  listingDetails: z.record(z.string(), z.any()).default({}),
});

module.exports = { patchStatusSchema, createPropertySchema, propertyIdParamSchema, softDeletePropertySchema };

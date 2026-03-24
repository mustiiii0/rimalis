const { z } = require('zod');

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8).max(128);

function sanitizeText(value) {
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { z, emailSchema, passwordSchema, sanitizeText };

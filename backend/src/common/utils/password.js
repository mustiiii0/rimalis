const bcrypt = require('bcryptjs');
const { env } = require('../../config/env');

async function hashPassword(rawPassword) {
  return bcrypt.hash(rawPassword, env.bcryptRounds);
}

async function comparePassword(rawPassword, hashedPassword) {
  return bcrypt.compare(rawPassword, hashedPassword);
}

module.exports = { hashPassword, comparePassword };
